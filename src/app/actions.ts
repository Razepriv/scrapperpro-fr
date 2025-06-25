
"use server";

import type { FirebaseApp } from 'firebase/app';
import { enhancePropertyContent } from '@/ai/flows/enhance-property-description';
import { extractPropertyInfo } from '@/ai/flows/extract-property-info';
import { savePropertiesToDb, saveHistoryEntry, updatePropertyInDb, deletePropertyFromDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { type Property, type HistoryEntry } from '@/lib/types';
import path from 'path';

// --- Firebase Configuration ---
// These credentials should be stored in your .env.local file
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Firebase Image Upload Logic ---
async function uploadImageToFirebase(imageUrl: string, propertyId: string): Promise<string> {
    // Dynamically import Firebase and UUID libraries only when this function is called.
    // This is crucial for avoiding build errors in Next.js.
    const { initializeApp, getApp, getApps } = await import('firebase/app');
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { v4: uuidv4 } = await import('uuid');

    // Fail-fast if Firebase is not configured.
    if (!firebaseConfig.apiKey || !firebaseConfig.storageBucket) {
        throw new Error("Firebase configuration is missing. Please check your .env file.");
    }
    
    // Download the image from the original source
    const response = await fetch(imageUrl, {
        headers: {
             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const fileExtension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `properties/${propertyId}/${uuidv4()}.${fileExtension}`;

    // Initialize Firebase App (if not already initialized)
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const storage = getStorage(app);
    const storageRef = ref(storage, fileName);

    // Upload the image buffer to Firebase Storage
    await uploadBytes(storageRef, imageBuffer, {
        contentType: `image/${fileExtension}`
    });

    // Get the permanent public URL
    const downloadURL = await getDownloadURL(storageRef);
    
    console.log(`Successfully uploaded image to Firebase Storage: ${downloadURL}`);
    return downloadURL;
}


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
    
    const processingPromises = properties.map(async (p, index) => {
        const propertyId = `prop-${Date.now()}-${index}`;
        
        // Step 1: Ensure all image URLs are absolute
        const absoluteImageUrls = (p.image_urls && Array.isArray(p.image_urls))
            ? p.image_urls.map((imgUrl: string) => {
                try {
                    if (!imgUrl) return null;
                    return new URL(imgUrl, originalUrl).href;
                } catch (e) {
                    console.warn(`Could not create absolute URL for image: ${imgUrl} with base: ${originalUrl}`);
                    return null;
                }
            }).filter((url: string | null): url is string => url !== null)
            : [];

        // Step 2: Upload images to Firebase and get public URLs
        const uploadedImageUrls = await Promise.all(
            absoluteImageUrls.map((imgUrl: string) => 
                uploadImageToFirebase(imgUrl, propertyId).catch(err => {
                    console.error(`Failed to upload image ${imgUrl}:`, err);
                    return 'https://placehold.co/600x400.png'; // Use placeholder on failure
                })
            )
        );

        const finalImageUrls = uploadedImageUrls.length > 0 ? uploadedImageUrls : ['https://placehold.co/600x400.png'];

        console.log(`Final image URLs for property:`, finalImageUrls);

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
    
    // We save to our database before returning, so the data is available immediately
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
    // Process URLs sequentially to be gentle on target servers
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


// NEW ACTIONS FOR DATABASE MANAGEMENT
export async function saveProperty(property: Property) {
    await savePropertiesToDb([property]); // savePropertiesToDb accepts an array
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
