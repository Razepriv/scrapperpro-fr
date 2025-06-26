
"use client";

import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import type { Property } from '@/lib/types';

const getAbsoluteUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) {
    return url;
  }
  // This function is client-side, so window should be available.
  if (typeof window !== 'undefined') {
    try {
        return new URL(url, window.location.origin).href;
    } catch (e) {
        return url; // Return original if it's not a valid partial URL
    }
  }
  // Fallback for any edge cases (e.g. server-side rendering context)
  return url; 
};

const createNestedObject = (prop: Property) => {
  // Using new field names from Property type and providing defaults for optional fields
  return {
    main: {
        id: prop.id,
        title: prop.title ?? 'N/A',
        propertyPrice: prop.propertyPrice ?? 'N/A', // Changed from price
        description: prop.description ?? 'N/A', // This is "Content"
        categories: prop.categories ?? [], // Changed from property_type (array now)
        whatDoYouRent: prop.whatDoYouRent ?? 'N/A', // Changed from what_do
        propertyFurnishingStatus: prop.propertyFurnishingStatus ?? 'N/A', // Changed from furnish_type
        // rental_timing: prop.rental_timing ?? 'N/A', // Optional, can be added if needed
        tenantType: prop.tenantType ?? 'N/A', // Changed from tenant_type
        scraped_at: prop.scraped_at ?? 'N/A',
        original_url: prop.original_url ?? 'N/A',
        page_link: prop.page_link ?? 'N/A',
    },
    location: {
        propertyAddress: prop.propertyAddress ?? 'N/A', // Changed from location
        city: prop.city ?? 'N/A',
        // county: prop.county ?? 'N/A', // This field was optional and might not be in new structure consistently
        neighborhoodArea: prop.neighborhoodArea ?? 'N/A', // Changed from neighborhood
        propertyCountry: prop.propertyCountry ?? 'N/A',
        propertyLongitude: prop.propertyLongitude ?? 0,
        propertyLatitude: prop.propertyLatitude ?? 0,
    },
    property_details: {
        propertyBed: prop.propertyBed ?? 0, // Changed from bedrooms
        propertyBathroom: prop.propertyBathroom ?? 0, // Changed from bathrooms
        propertyLivingRoom: prop.propertyLivingRoom ?? 0,
        propertyRoom: prop.propertyRoom ?? 0,
        propertySize: prop.propertySize ?? 'N/A', // Changed from area
        // floor_number: prop.floor_number ?? 0, // Optional
        propertyBuilding: prop.propertyBuilding ?? 'N/A', // Changed from building_information
        propertyTax: prop.propertyTax ?? 'N/A',
        propertyDeposit: prop.propertyDeposit ?? 'N/A',
        propertyDiscount: prop.propertyDiscount ?? 'N/A',
    },
    status_and_terms: {
        propertyDisplayStatus: prop.propertyDisplayStatus ?? 'N/A',
        propertyApprovalStatus: prop.propertyApprovalStatus ?? 'N/A',
        propertyMinimumStay: prop.propertyMinimumStay ?? 'N/A',
        propertyMaximumStay: prop.propertyMaximumStay ?? 'N/A',
        propertyMinimumNotice: prop.propertyMinimumNotice ?? 'N/A',
        termAndCondition: prop.termAndCondition ?? 'N/A', // Changed from terms_and_condition
    },
    preferences_flags: {
        propertyGenderPreference: prop.propertyGenderPreference ?? 'N/A',
        featuredProperty: prop.featuredProperty ?? false,
        platinumProperty: prop.platinumProperty ?? false,
        premiumProperty: prop.premiumProperty ?? false,
    },
    features_and_amenities: { // Changed from features
        featuresAndAmenities: prop.featuresAndAmenities ?? [],
    },
    images: {
        image_url: getAbsoluteUrl(prop.image_url ?? ''),
        image_urls: (prop.image_urls ?? []).map(url => getAbsoluteUrl(url ?? '')),
    },
    legal_and_reference: { // Changed from legal
        validated_information: prop.validated_information ?? 'N/A',
        permit_number: prop.permit_number ?? 'N/A',
        ded_license_number: prop.ded_license_number ?? 'N/A',
        rera_registration_number: prop.rera_registration_number ?? 'N/A',
        dld_brn: prop.dld_brn ?? 'N/A',
        reference_id: prop.reference_id ?? 'N/A',
        // mortgage: prop.mortgage ?? 'N/A', // Optional
    },
    agent_and_owner: { // Changed from agent
        propertyAgent: prop.propertyAgent ?? 'N/A',
        propertyOwnerDetails: prop.propertyOwnerDetails ?? 'N/A',
        listed_by_name: prop.listed_by_name ?? 'N/A', // Can be redundant if covered by Agent/Owner
        listed_by_phone: prop.listed_by_phone ?? 'N/A',
        listed_by_email: prop.listed_by_email ?? 'N/A',
    },
    ai_enhancements_originals: { // Changed from ai_enhancements
        // enhanced_title: prop.enhanced_title ?? 'N/A', // Now part of main.title
        // enhanced_description: prop.enhanced_description ?? 'N/A', // Now part of main.description
        original_title: prop.original_title ?? 'N/A',
        original_description: prop.original_description ?? 'N/A', // This is original "Content"
    },
    additional: { // For fields not fitting elsewhere or less critical optional ones
        matterportLink: prop.matterportLink ?? 'N/A',
        // Add other optional fields from old or new schema here if needed for export
        // e.g. prop.mortgage, prop.county, prop.rental_timing, prop.floor_number
    }
  };
};

const flattenObject = (obj: any, parentKey = '', result: { [key: string]: any } = {}) => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
        flattenObject(obj[key], newKey, result);
      } else if (Array.isArray(obj[key])) {
        result[newKey] = obj[key].join(' | ');
      }
      else {
        result[newKey] = obj[key];
      }
    }
  }
  return result;
};


// Function to download data as a JSON file
export const downloadJson = (data: Property[], filename: string) => {
  const flattenedData = data.map(prop => flattenObject(createNestedObject(prop)));
  const jsonString = JSON.stringify(flattenedData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
};

// Function to download data as a CSV file
export const downloadCsv = (data: Property[], filename:string) => {
    const flattenedData = data.map(prop => flattenObject(createNestedObject(prop)));

    if (flattenedData.length === 0) {
        alert("No data to export.");
        return;
    }
    
    const worksheet = utils.json_to_sheet(flattenedData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Properties');

    // Generate CSV output
    const csvOutput = write(workbook, { bookType: 'csv', type: 'string' });
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
};

// Function to download data as an Excel file
export const downloadExcel = (data: Property[], filename: string) => {
  const flattenedData = data.map(prop => flattenObject(createNestedObject(prop)));

    if (flattenedData.length === 0) {
        alert("No data to export.");
        return;
    }
  
  const worksheet = utils.json_to_sheet(flattenedData);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Properties');

  // Generate XLSX output
  const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  saveAs(blob, `${filename}.xlsx`);
};
