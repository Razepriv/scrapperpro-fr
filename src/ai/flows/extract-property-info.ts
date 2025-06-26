'use server';
/**
 * @fileOverview A Genkit flow to extract property information from HTML.
 *
 * - extractPropertyInfo - Extracts structured property data from HTML content.
 * - ExtractPropertyInfoInput - The input type for the extractPropertyInfo function.
 * - ExtractPropertyInfoOutput - The return type for the extractPropertyInfo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Maps to the new Property interface in src/lib/types.ts
const ExtractedPropertySchema = z.object({
  // Core Identification & Meta (id, original_url, scraped_at are added post-extraction)
  page_link: z.string().optional().describe('Direct link to the property details page from the source website.'),
  reference_id: z.string().optional().describe('Unique reference ID or listing number from the source property listing.'),

  // Original Content (AI might provide this directly, or we use it as a base for enhancement later)
  original_title: z.string().optional().describe('The original, unedited title of the property listing as seen on the page.'),
  original_description: z.string().optional().describe('The original, unedited full description text of the property. Maps to "Content" requirement initially.'),

  // Enhanced or Final Content Fields (AI should attempt to fill these)
  title: z.string().optional().describe('The primary title of the property listing. This might be the same as original_title or an enhanced version.'),
  description: z.string().optional().describe('A detailed description of the property. This might be the same as original_description or an enhanced version. This is the main "Content" field.'),

  // Fields from requirements document
  image_urls: z.array(z.string()).optional().describe('A list of all discoverable image URLs for the property. These will be processed later. This is the "Image" field.'),
  matterportLink: z.string().optional().describe('Link to a Matterport 3D tour, if available.'),
  categories: z.array(z.string()).optional().describe('List of categories the property falls into (e.g., "Residential", "Villa", "Commercial").'),
  whatDoYouRent: z.string().optional().describe('Purpose of the listing (e.g., "For Sale", "For Rent", "Short Term Lease"). Maps to "What do you rent ?".'),
  city: z.string().optional().describe('The city where the property is located.'),
  neighborhoodArea: z.string().optional().describe('The specific neighborhood or area within the city.'),
  propertyAgent: z.string().optional().describe('Name or details of the property agent or agency.'),
  tenantType: z.string().optional().describe('Preferred tenant type (e.g., "Family", "Bachelor", "Professionals").'),
  nationality: z.string().optional().describe('Preferred tenant nationality, if specified.'),
  religion: z.string().optional().describe('Preferred tenant religion, if specified.'),
  propertyCountry: z.string().optional().describe('The country where the property is located.'),
  propertyBuilding: z.string().optional().describe('Name or specific details of the property building or complex.'),
  propertyPrice: z.string().optional().describe('Listing price of the property, including currency if possible (e.g., "AED 500,000", "$1,200/month").'),
  propertyDiscount: z.string().optional().describe('Details of any applicable discounts on the price.'),
  propertyDeposit: z.string().optional().describe('Required deposit amount or terms.'),
  propertySize: z.string().optional().describe('Total area of the property (e.g., "2500 sqft", "150 sqm").'),
  propertyTax: z.string().optional().describe('Information about property taxes, if available.'),
  propertyDisplayStatus: z.string().optional().describe('Current display status of the listing (e.g., "Active", "Under Offer", "Sold", "Rented").'),
  propertyGenderPreference: z.string().optional().describe('Gender preference for tenants, if applicable (e.g., "Male Only", "Female Only", "Any").'),

  featuredProperty: z.boolean().optional().describe('Is this a featured property? (true/false)'),
  platinumProperty: z.boolean().optional().describe('Is this a platinum property? (true/false)'),
  premiumProperty: z.boolean().optional().describe('Is this a premium property? (true/false)'),

  propertyOwnerDetails: z.string().optional().describe('Contact or other details of the property owner, if available and distinct from agent.'),
  propertyMinimumStay: z.string().optional().describe('Minimum rental duration (e.g., "1 year", "6 months", "30 days").'),
  propertyMaximumStay: z.string().optional().describe('Maximum rental duration, if specified.'),
  propertyBed: z.number().optional().describe('Number of bedrooms.'),
  propertyLivingRoom: z.number().optional().describe('Number of living rooms.'),
  propertyRoom: z.number().optional().describe('Total number of rooms (if specified differently from bedrooms/living rooms).'),
  propertyBathroom: z.number().optional().describe('Number of bathrooms.'),
  propertyAddress: z.string().optional().describe('Full street address or detailed location of the property.'),
  propertyLongitude: z.number().optional().describe('Geographical longitude of the property.'),
  propertyLatitude: z.number().optional().describe('Geographical latitude of the property.'),
  propertyApprovalStatus: z.string().optional().describe('Official approval status of the listing or property (e.g., "Approved", "Pending Approval").'),
  propertyFurnishingStatus: z.string().optional().describe('Furnishing status (e.g., "Furnished", "Unfurnished", "Semi-furnished").'),
  propertyMinimumNotice: z.string().optional().describe('Minimum notice period required for viewing or termination (e.g., "24 hours", "1 month").'),

  featuresAndAmenities: z.array(z.string()).optional().describe('List of key features, facilities, or amenities available with the property.'),
  termAndCondition: z.string().optional().describe('Specific terms and conditions related to the property sale or rental.'),

  // Regulatory/Reference IDs & Contact Info (from old schema, still useful)
  validated_information: z.string().optional().describe('Any information explicitly marked as "Validated" or "Verified" on the page.'),
  permit_number: z.string().optional().describe('Official permit number for the listing or construction, if available.'),
  ded_license_number: z.string().optional().describe('The DED (Department of Economic Development) license number, if applicable.'),
  rera_registration_number: z.string().optional().describe('The RERA (Real Estate Regulatory Agency) registration number, if applicable.'),
  dld_brn: z.string().optional().describe('The DLD (Dubai Land Department) BRN (Broker Registration Number), if applicable.'),
  listed_by_name: z.string().optional().describe('The name of the person or agency listing the property (can overlap with PropertyAgent or PropertyOwnerDetails).'),
  listed_by_phone: z.string().optional().describe('Contact phone number for the listing.'),
  listed_by_email: z.string().optional().describe('Contact email address for the listing.'),

  // Fields from old schema that didn't directly map but might be extractable or useful contextually
  // These are now explicitly optional or integrated above.
  // mortgage: z.string().optional().describe('Mortgage information, if available.'),
  // county: z.string().optional().describe('The county where the property is located.'), (Covered by new location fields)
  // rental_timing: z.string().optional().describe('The timing for rental (e.g., Immediately, Flexible).'), (Can be part of description or a specific new field if AI can get it)
  // floor_number: z.number().optional().describe('The floor number of the property.'), (Can be part of PropertyBuilding or a specific new field)
  // property_type: z.string().optional().describe('The type of property (e.g., House, Apartment).'), (Now covered by 'categories')
});

const ExtractPropertyInfoInputSchema = z.object({
  htmlContent: z.string().describe('The full HTML content of a property listing page.'),
});
export type ExtractPropertyInfoInput = z.infer<typeof ExtractPropertyInfoInputSchema>;

const ExtractPropertyInfoOutputSchema = z.object({
  properties: z.array(ExtractedPropertySchema).describe('An array of properties found on the page.'),
});
export type ExtractPropertyInfoOutput = z.infer<typeof ExtractPropertyInfoOutputSchema>;


export async function extractPropertyInfo(
  input: ExtractPropertyInfoInput
): Promise<ExtractPropertyInfoOutput> {
  return extractPropertyInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPropertyInfoPrompt',
  input: {schema: ExtractPropertyInfoInputSchema},
  output: {schema: ExtractPropertyInfoOutputSchema},
  prompt: `You are an expert at extracting structured data from real estate web pages. Analyze the following HTML content and extract details for ALL properties listed.

Your goal is to meticulously populate ALL fields in the provided JSON schema. Pay close attention to the new and expanded field requirements.

**KEY FIELDS TO EXTRACT (among others defined in the schema):**
- **Core Details:** title, description (as 'content'), propertyPrice, propertySize, propertyAddress, city, neighborhoodArea, propertyCountry.
- **Listing Specifics:** whatDoYouRent, categories, propertyAgent, tenantType, propertyFurnishingStatus, propertyBed, propertyBathroom, propertyLivingRoom, propertyRoom.
- **Financials & Terms:** propertyDiscount, propertyDeposit, propertyTax, propertyMinimumStay, propertyMaximumStay, termAndCondition.
- **Special Links & Flags:** matterportLink, featuredProperty (true/false), platinumProperty (true/false), premiumProperty (true/false).
- **Location Details:** propertyLongitude, propertyLatitude.
- **Contact & Regulatory:** propertyOwnerDetails, listed_by_name, listed_by_phone, listed_by_email, permit_number, rera_registration_number, reference_id.
- **Features & Amenities:** featuresAndAmenities (as an array).

**CRITICAL INSTRUCTIONS FOR DATA EXTRACTION & FORMATTING:**
- **Schema Adherence:** Strictly follow the output JSON schema. If a field is not found, it should be omitted (if optional and no default value is sensible) or set to a schema-compliant default (e.g., empty string for optional strings, empty array for optional arrays).
- **Empty Values:**
    - For **optional string fields**: If information is not found, return an empty string "".
    - For **optional number fields**: If information is not found, you may omit the field or return 0 if appropriate for the context (e.g., propertyBed: 0).
    - For **optional boolean fields**: Return true or false. If information is not found, you may omit the field.
    - For **optional array fields** (e.g., image_urls, categories, featuresAndAmenities): If no items are found, return an empty array [].
- **Image Extraction:**
    - Find all relevant, high-quality image URLs. Look in \`<img>\` (src, data-src, etc.), \`<picture>\` (\`srcset\`), and CSS backgrounds.
    - For 'image_urls', if NO images are found, return an empty array []. DO NOT return placeholder URLs.
    - Ensure image URLs are absolute (starting with http or https). Attempt to resolve relative URLs based on the page's domain.
- **Contact Details:** Extract names, phone numbers, and emails for agents or listing contacts.
- **Numerical Data:** Extract numbers cleanly (e.g., for bedrooms, bathrooms, longitude, latitude).
- **Address Components:** Try to break down location information into specific fields like propertyAddress, city, neighborhoodArea, propertyCountry.

HTML Content:
\`\`\`html
{{{htmlContent}}}
\`\`\`

Extract all property information based on the full schema and return it in the specified JSON format. If no properties are found on the page, return an empty array for the 'properties' field.`,
});

const extractPropertyInfoFlow = ai.defineFlow(
  {
    name: 'extractPropertyInfoFlow',
    inputSchema: ExtractPropertyInfoInputSchema,
    outputSchema: ExtractPropertyInfoOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      return output ?? { properties: [] };
    } catch (error) {
      console.error("Error during AI-powered property extraction:", error);
      // Return an empty object to prevent the entire scraping process from failing
      // if the AI model returns malformed data.
      return { properties: [] };
    }
  }
);
