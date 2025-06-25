
"use server";

import type { FirebaseApp } from 'firebase/app';
import { enhancePropertyContent } from '@/ai/flows/enhance-property-description';
import { extractPropertyInfo } from '@/ai/flows/extract-property-info';
import { savePropertiesToDb, saveHistoryEntry, updatePropertyInDb, deletePropertyFromDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { type Property, type HistoryEntry } from '@/lib/types';

// --- Firebase Configuration ---
// These credentials should be stored in your .env file
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function getHtml(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error fetching URL ${url}:`, error);
        if (error instanceof Error) {
            throw new Error(`Could not retrieve content from ${url}. Reason: ${error.message}`);
        }
        throw new Error(`Could not retrieve content from ${url}.`);
    }
}

async function processAndSaveHistory(properties: any[], originalUrl: string, historyEntry: Omit<HistoryEntry, 'id' | 'date' | 'propertyCount'>) {
    console.log(`AI extracted ${properties.length} properties. Processing content...`);
    
    if (!firebaseConfig.apiKey || !firebaseConfig.storageBucket) {
        throw new Error("Firebase configuration is missing. Please check your .env file.");
    }
    
    const processingPromises = properties.map(async (p, index) => {
        const propertyId = `prop-${Date.now()}-${index}`;
        
        // Step 1: Ensure all image URLs are absolute
        const absoluteImageUrls = (p.image_urls && Array.isArray(p.image_urls))
            ? p.image_urls.map((imgUrl: string) => {
                try {
                    if (!imgUrl) return null;
                    const baseUrl = originalUrl.startsWith('http') ? originalUrl : (p.page_link || 'https://example.com');
                    return new URL(imgUrl, baseUrl).href;
                } catch (e) {
                    console.warn(`Could not create absolute URL for image: ${imgUrl}`);
                    return null;
                }
            }).filter((url: string | null): url is string => url !== null)
            : [];

        // Step 2: Upload images to Firebase and get public URLs
        console.log(`[Image Processing] Starting for propertyId: ${propertyId}. Found ${absoluteImageUrls.length} candidate images.`);
        const imageProcessingPromises = absoluteImageUrls.map(async (imgUrl, imgIndex) => {
            try {
                console.log(`[Image Processing] [${imgIndex+1}/${absoluteImageUrls.length}] Attempting to fetch: ${imgUrl}`);
                const referer = originalUrl.startsWith('http') ? originalUrl : (p.page_link || 'https://example.com');
                const response = await fetch(imgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; PropScrapeAI/1.0)',
                        'Referer': referer,
                    },
                });

                if (!response.ok) {
                    throw new Error(`Fetch failed with status ${response.status}`);
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new Error(`Invalid content-type: ${contentType}. Expected an image.`);
                }

                const imageBuffer = await response.arrayBuffer();
                 if (imageBuffer.byteLength === 0) {
                    throw new Error('Downloaded image buffer is empty.');
                }
                const imageSizeKB = Math.round(imageBuffer.byteLength / 1024);
                console.log(`[Image Download] [${imgIndex+1}] Success. Size: ${imageSizeKB}KB. Content-Type: ${contentType}`);
                    
                const fileExtension = contentType.split('/')[1]?.split('+')[0] || 'jpg';
                const fileName = `properties/${propertyId}/${Date.now()}_${imgIndex}.${fileExtension}`;

                const { initializeApp, getApp, getApps } = await import('firebase/app');
                const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
                const storage = getStorage(app);
                const storageRef = ref(storage, fileName);

                console.log(`[Image Upload] [${imgIndex+1}] Uploading to Firebase Storage at path: ${fileName}`);
                await uploadBytes(storageRef, imageBuffer, { contentType });
                const downloadURL = await getDownloadURL(storageRef);
                console.log(`[Image Upload] [${imgIndex+1}] Success. URL: ${downloadURL}`);
                return downloadURL;

            } catch (err: any) {
                console.error(`[Image Processing] [${imgIndex+1}] Failed to process image ${imgUrl}. Error:`, err.message);
                // Return the original URL on failure so the frontend can try to render it and show an error.
                return imgUrl;
            }
        });
        
        const processedImageUrls = (await Promise.all(imageProcessingPromises)).filter((url): url is string => !!url);

        // Use a placeholder only if no images were found or processed successfully.
        const finalImageUrls = processedImageUrls.length > 0 ? processedImageUrls : ['https://placehold.co/600x400.png'];

        // Step 3: Enhance text content
        const enhancedContent = (p.title && p.description) 
            ? await enhancePropertyContent({ title: p.title, description: p.description })
            : { enhancedTitle: p.title, enhancedDescription: p.description };
        
        // Step 4: Assemble final property object
        return {
            ...p,
            id: propertyId,
            original_url: originalUrl,
            original_title: p.title,
            original_description: p.description,
            title: enhancedContent.enhancedTitle,
            description: enhancedContent.enhancedDescription,
            enhanced_title: enhancedContent.enhancedTitle,
            enhanced_description: enhancedContent.enhancedDescription,
            scraped_at: new Date().toISOString(),
            image_urls: finalImageUrls,
            image_url: finalImageUrls[0],
        };
    });

    const finalProperties = await Promise.all(processingPromises);
    
    console.log('Content processing complete.');
    
    await savePropertiesToDb(finalProperties);
    
    await saveHistoryEntry({
        ...historyEntry,
        propertyCount: finalProperties.length,
    });

    revalidatePath('/history');
    revalidatePath('/database');

    return finalProperties;
}


export async function scrapeUrl(url: string): Promise<Property[] | null> {
    console.log(`Scraping URL: ${url}`);

    if (!url || !url.includes('http')) {
        throw new Error('Invalid URL provided.');
    }
    
    const htmlContent = await getHtml(url);
    const result = await extractPropertyInfo({ htmlContent });
    if (!result || !result.properties) {
        console.log("AI extraction returned no properties.");
        return [];
    }
    
    return processAndSaveHistory(result.properties, url, { type: 'URL', details: url });
}

export async function scrapeHtml(html: string, originalUrl: string = 'scraped-from-html'): Promise<Property[] | null> {
    console.log(`Scraping HTML of length: ${html.length}`);

    if (!html || html.length < 100) {
        throw new Error('Invalid HTML provided.');
    }

    const result = await extractPropertyInfo({ htmlContent: html });
    if (!result || !result.properties) {
        console.log("AI extraction returned no properties.");
        return [];
    }
    
    return processAndSaveHistory(result.properties, originalUrl, { type: 'HTML', details: 'Pasted HTML content' });
}

export async function scrapeBulk(urls: string): Promise<Property[] | null> {
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    console.log(`Bulk scraping ${urlList.length} URLs.`);

    if (urlList.length === 0) {
        throw new Error('No valid URLs found in bulk input.');
    }
    
    const allResults: Property[] = [];
    for (const url of urlList) {
        try {
            console.log(`Scraping ${url} in bulk...`);
            const htmlContent = await getHtml(url);
            const result = await extractPropertyInfo({ htmlContent });
            if (result && result.properties) {
                const processed = await processAndSaveHistory(result.properties, url, {type: 'BULK', details: `Bulk operation included: ${url}`});
                allResults.push(...processed);
            }
        } catch (error) {
            console.error(`Failed to scrape ${url} during bulk operation:`, error);
        }
    }
    
    return allResults;
}


export async function saveProperty(property: Property) {
    await savePropertiesToDb([property]);
    revalidatePath('/database');
}

export async function updateProperty(property: Property) {
    await updatePropertyInDb(property);
    revalidatePath('/database');
}

export async function deleteProperty(propertyId: string) {
    await deletePropertyFromDb(propertyId);
    revalidatePath('/database');
}

export async function reEnhanceProperty(property: Property): Promise<Property | null> {
    try {
        const enhancedContent = await enhancePropertyContent({ 
            title: property.original_title, 
            description: property.original_description 
        });

        const updatedProperty = {
            ...property,
            title: enhancedContent.enhancedTitle,
            description: enhancedContent.enhancedDescription,
            enhanced_title: enhancedContent.enhancedTitle,
            enhanced_description: enhancedContent.enhancedDescription,
        };
        
        await updatePropertyInDb(updatedProperty);
        revalidatePath('/database');
        
        return updatedProperty;
    } catch(error) {
        console.error("Failed to re-enhance property:", error);
        return null;
    }
}
