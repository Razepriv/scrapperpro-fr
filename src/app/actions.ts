
"use server";

import { promises as fs } from 'fs';
import path from 'path';
import { enhancePropertyContent } from '@/ai/flows/enhance-property-description';
import { extractPropertyInfo } from '@/ai/flows/extract-property-info';
import { savePropertiesToDb, saveHistoryEntry, updatePropertyInDb, deletePropertyFromDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { type Property, type HistoryEntry } from '@/lib/types';

export type { Property, HistoryEntry }; // Re-export types

interface BulkScrapeError {
    url: string;
    error: string;
}

export interface ScrapeBulkResult {
    properties: Property[];
    errors: BulkScrapeError[];
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
            const errorText = await response.text().catch(() => 'Could not retrieve error body.');
            console.error(`Error fetching URL ${url}: HTTP ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 500)}`);
            throw new Error(`Failed to fetch URL ${url}: HTTP ${response.status} ${response.statusText}.`);
        }
        return await response.text();
    } catch (error: any) {
        console.error(`Error fetching URL ${url}:`, error);
        if (error instanceof Error && error.message.startsWith('Failed to fetch URL')) {
            // This is an error we've already processed and logged from the !response.ok block
            throw error;
        } else if (error instanceof Error) {
            // This could be a network error (e.g., DNS resolution failure) or other fetch-related error
            throw new Error(`Could not retrieve content from ${url}. Reason: ${error.message}`);
        }
        // Fallback for non-Error objects (though rare in modern JS)
        throw new Error(`Could not retrieve content from ${url}. Reason: ${String(error)}`);
    }
}

async function processScrapedData(properties: any[], originalUrl: string, historyEntry: Omit<HistoryEntry, 'id' | 'date' | 'propertyCount'>) {
    console.log(`AI extracted ${properties.length} properties. Processing content...`);
    
    const processingPromises = properties.map(async (p, index) => {
        const propertyId = `prop-${Date.now()}-${index}`;
        
        const absoluteImageUrls = (p.image_urls && Array.isArray(p.image_urls))
            ? p.image_urls.map((imgUrl: string) => {
                if (!imgUrl || typeof imgUrl !== 'string') return null;
                try {
                    // If imgUrl is already absolute
                    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
                        return new URL(imgUrl).href;
                    }

                    // Determine a valid base URL
                    let baseUrlToUse: string | undefined;
                    if (p.page_link && (p.page_link.startsWith('http://') || p.page_link.startsWith('https://'))) {
                        baseUrlToUse = p.page_link;
                    } else if (originalUrl && (originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
                        baseUrlToUse = originalUrl;
                    }

                    if (baseUrlToUse) {
                        return new URL(imgUrl, baseUrlToUse).href;
                    } else {
                        console.warn(`[Image Processing] Could not determine an absolute base URL for relative image: ${imgUrl}. Original URL: ${originalUrl}, Page Link: ${p.page_link}`);
                        return null; // Cannot make it absolute
                    }
                } catch (e: any) {
                    console.warn(`[Image Processing] Could not create absolute URL for image: ${imgUrl}. Error: ${e.message}`);
                    return null; // Return null if URL construction fails
                }
            }).filter((url: string | null): url is string => url !== null)
            : [];

        console.log(`[Image Processing] Starting for propertyId: ${propertyId}. Found ${absoluteImageUrls.length} candidate images from AI:`, p.image_urls);
        
        const imageProcessingPromises = absoluteImageUrls.map(async (imgUrl: string, imgIndex: number) => {
            try {
                console.log(`[Image Processing] [${imgIndex+1}/${absoluteImageUrls.length}] Attempting to fetch: ${imgUrl} for propertyId: ${propertyId}`);
                const referer = originalUrl.startsWith('http') ? originalUrl : (p.page_link || ''); // Provide empty string if no valid referer
                const response = await fetch(imgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; PropScrapeAI/1.0; +http://example.com/bot)', // Added bot info
                        'Referer': referer,
                        'Accept': 'image/*,*/*;q=0.8', // Accept images primarily
                    },
                });

                if (!response.ok) {
                    throw new Error(`Fetch failed for ${imgUrl} with status ${response.status} ${response.statusText}`);
                }
                
                const contentType = response.headers.get('content-type');
                let fileExtension = 'jpg'; // Default extension

                if (contentType && contentType.startsWith('image/')) {
                    fileExtension = contentType.split('/')[1]?.split('+')[0]?.toLowerCase() || 'jpg';
                    if (fileExtension === 'jpeg') fileExtension = 'jpg';
                     // Basic sanitization for file extension
                    if (!/^[a-z0-9]+$/.test(fileExtension)) {
                        console.warn(`[Image Processing] Invalid characters in derived file extension '${fileExtension}' from contentType '${contentType}'. Defaulting to 'jpg'.`);
                        fileExtension = 'jpg';
                    }
                } else {
                    console.warn(`[Image Processing] Invalid or missing content-type for ${imgUrl}: ${contentType}. Will attempt to process buffer.`)
                    // Attempt to guess extension from URL if content type is missing/invalid
                    const urlPath = new URL(imgUrl).pathname;
                    const extFromUrl = urlPath.substring(urlPath.lastIndexOf('.') + 1);
                    if (extFromUrl && /^[a-z0-9]+$/.test(extFromUrl) && extFromUrl.length < 5) {
                        fileExtension = extFromUrl;
                        console.log(`[Image Processing] Guessed extension '${fileExtension}' from URL ${imgUrl}`);
                    }
                }

                const imageBuffer = await response.arrayBuffer();
                 if (imageBuffer.byteLength === 0) {
                    throw new Error(`Downloaded image buffer is empty for ${imgUrl}.`);
                }
                const imageSizeKB = Math.round(imageBuffer.byteLength / 1024);
                console.log(`[Image Download] [${imgIndex+1}/${absoluteImageUrls.length}] Success for ${imgUrl}. Size: ${imageSizeKB}KB. Content-Type: ${contentType}`);
                    
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
        
        const enhancedContent = await enhancePropertyContent({ title: p.title || '', description: p.description || '' });
        
        const processedProperty: Property = {
            ...p, // Spreading AI extracted data first
            id: propertyId,
            original_url: originalUrl,
            // Ensure original_title and original_description are from p, if they exist
            original_title: p.original_title || p.title || '',
            original_description: p.original_description || p.description || '',

            // Enhanced content
            title: enhancedContent.enhancedTitle,
            description: enhancedContent.enhancedDescription,
            // enhanced_title and enhanced_description are effectively the same as title and description post-enhancement
            // So we can remove them if 'title' and 'description' are always the enhanced versions.
            // For clarity with the Property type, let's ensure they are explicitly set if distinct.
            // However, the current Property type has title & description as the primary, and original_ as pre-enhancement.
            // So, enhanced_title and enhanced_description from the old type might be redundant if title/desc are always post-enhancement.
            // Let's stick to:
            // title: enhancedContent.enhancedTitle, (This is Property.title)
            // description: enhancedContent.enhancedDescription, (This is Property.description)

            scraped_at: new Date().toISOString(),
            image_urls: finalImageUrls,
            image_url: finalImageUrls[0],

            // Apply default values as per requirements
            // Make sure these fields exist in the Property type
            propertyCountry: p.propertyCountry || "UAE",
            propertyAgent: p.propertyAgent || "ahmed",

            // Ensure all required fields from Property type have some default if not provided by 'p'
            // This depends on how strictly we want to enforce the Property type here.
            // For now, assuming 'p' (AI output) + defaults + overrides is the goal.
            // Optional fields from Property type will remain undefined if not in 'p' and not defaulted.
        };

        // Clean up any fields that were in 'p' (AI output) but are not in our final Property type
        // This is harder to do dynamically without a list of valid keys.
        // For now, we rely on the spread ...p and then specific overrides.
        // If p contains fields not in Property, they will persist if not cleaned.
        // This is generally fine for JSON, but for typed objects, it's good to be aware.

        return processedProperty;
    });

    const finalProperties: Property[] = await Promise.all(processingPromises);
    
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

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
        }
    } catch (e: any) {
        console.error(`[Validation Error] Invalid URL format for "${url}": ${e.message}`);
        throw new Error(`Invalid URL provided: "${url}". Please ensure it is a valid HTTP or HTTPS URL. Reason: ${e.message}`);
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

export async function scrapeBulk(urls: string): Promise<ScrapeBulkResult> {
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    console.log(`Bulk scraping ${urlList.length} URLs.`);

    if (urlList.length === 0) {
        throw new Error('No valid URLs found in bulk input.');
    }
    
    const allResults: Property[] = [];
    const errors: { url: string, error: string }[] = [];

    for (const url of urlList) {
        try {
            console.log(`[Bulk Scrape] Processing URL: ${url}`);
            const htmlContent = await getHtml(url);
            const result = await extractPropertyInfo({ htmlContent });
            if (result && result.properties && result.properties.length > 0) {
                const processed = await processScrapedData(result.properties, url, {type: 'BULK', details: `Bulk operation included: ${url}`});
                allResults.push(...processed);
                console.log(`[Bulk Scrape] Successfully processed ${url}. Found ${processed.length} properties.`);
            } else {
                console.log(`[Bulk Scrape] No properties found or extracted for ${url}.`);
                // Optional: Add to errors if no properties found is considered a failure for a given URL
                // errors.push({ url, error: "No properties extracted." });
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Bulk Scrape] Failed to scrape ${url}:`, errorMessage);
            errors.push({ url, error: errorMessage });
        }
    }
    
    console.log(`[Bulk Scrape] Completed. ${allResults.length} properties scraped from ${urlList.length - errors.length} URLs. ${errors.length} URLs failed.`);
    if (errors.length > 0) {
        console.warn("[Bulk Scrape] Failed URLs and errors:");
        errors.forEach(err => console.warn(`  - ${err.url}: ${err.error}`));
    }

    // Note: The return type of the function will change.
    // Callers will need to be updated to handle { properties: Property[], errors: BulkScrapeError[] }
    return { properties: allResults, errors };
}

// Update the function signature if necessary in other files if type checking is strict.
// For now, assuming loose coupling or subsequent updates to callers.

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
