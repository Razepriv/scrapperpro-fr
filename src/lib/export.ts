"use client";

import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import type { Property } from '@/lib/types';

const getAbsoluteUrl = (url: string) => {
  if (url.startsWith('http')) {
    return url;
  }
  if (typeof window !== 'undefined') {
    return new URL(url, window.location.origin).href;
  }
  // Fallback for server-side rendering (less ideal)
  return `https://your-domain.com${url}`; 
};

const createNestedObject = (prop: Property) => {
  return {
    main: {
        id: prop.id,
        title: prop.title,
        price: prop.price,
        description: prop.description,
        property_type: prop.property_type,
        what_do: prop.what_do,
        furnish_type: prop.furnish_type,
        rental_timing: prop.rental_timing,
        tenant_type: prop.tenant_type,
        scraped_at: prop.scraped_at,
        original_url: prop.original_url,
    },
    location: {
        location: prop.location,
        city: prop.city,
        county: prop.county,
        neighborhood: prop.neighborhood,
    },
    property_details: {
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        area: prop.area,
        floor_number: prop.floor_number,
        building_information: prop.building_information,
    },
    features: {
        features: prop.features,
    },
    images: {
        image_url: getAbsoluteUrl(prop.image_url),
        image_urls: prop.image_urls.map(getAbsoluteUrl),
    },
    legal: {
        validated_information: prop.validated_information,
        permit_number: prop.permit_number,
        ded_license_number: prop.ded_license_number,
        rera_registration_number: prop.rera_registration_number,
        dld_brn: prop.dld_brn,
        reference_id: prop.reference_id,
        terms_and_condition: prop.terms_and_condition,
        mortgage: prop.mortgage,
    },
    agent: {
        listed_by_name: prop.listed_by_name,
        listed_by_phone: prop.listed_by_phone,
        listed_by_email: prop.listed_by_email,
    },
    ai_enhancements: {
        enhanced_title: prop.enhanced_title,
        enhanced_description: prop.enhanced_description,
        original_title: prop.original_title,
        original_description: prop.original_description,
    },
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
