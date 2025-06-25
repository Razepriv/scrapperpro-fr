
"use server";

import { promises as fs } from 'fs';
import path from 'path';
import { enhancePropertyContent } from '@/ai/flows/enhance-property-description';
import { extractPropertyInfo } from '@/ai/flows/extract-property-info';
import { savePropertiesToDb, saveHistoryEntry, updatePropertyInDb, deletePropertyFromDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { type Property, type HistoryEntry } from '@/lib/types';

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

async function processScrapedData(properties: any[], originalUrl: string, historyEntry: Omit<HistoryEntry, 'id' | 'date' | 'propertyCount'>) {
    console.log(`AI extracted ${properties.length} properties. Processing content...`);
    
    const processingPromises = properties.map(async (p, index) => {
        const propertyId = `prop-${Date.now()}-${index}`;
        
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
                const propertyImageDir = path.join(process.cwd(), 'public', 'uploads', 'properties', propertyId);
                await fs.mkdir(propertyImageDir, { recursive: true });

                const fileName = `${Date.now()}_${imgIndex}.${fileExtension}`;
                const filePath = path.join(propertyImageDir, fileName);

                console.log(`[Image Save] [${imgIndex+1}] Saving to local path: ${filePath}`);
                await fs.writeFile(filePath, Buffer.from(imageBuffer));
                
                const publicUrl = `/uploads/properties/${propertyId}/${fileName}`;
                console.log(`[Image Save] [${imgIndex+1}] Success. Public URL: ${publicUrl}`);
                return publicUrl;

            } catch (err: any) {
                console.error(`[Image Processing] [${imgIndex+1}] Failed to process image ${imgUrl}. Error:`, err.message);
                return imgUrl; // Fallback to original URL on failure
            }
        });
        
        const processedImageUrls = (await Promise.all(imageProcessingPromises)).filter((url): url is string => !!url);

        const finalImageUrls = processedImageUrls.length > 0 ? processedImageUrls : ['https://placehold.co/600x400.png'];
        
        const enhancedContent = await enhancePropertyContent({ title: p.title, description: p.description });
        
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
    
    await saveHistoryEntry({
        ...historyEntry,
        propertyCount: finalProperties.length,
    });

    revalidatePath('/history');

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
    
    return processScrapedData(result.properties, url, { type: 'URL', details: url });
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
    
    return processScrapedData(result.properties, originalUrl, { type: 'HTML', details: 'Pasted HTML content' });
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
                const processed = await processScrapedData(result.properties, url, {type: 'BULK', details: `Bulk operation included: ${url}`});
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
