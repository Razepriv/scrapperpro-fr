'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { type Property, type HistoryEntry } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const dbPath = path.join(process.cwd(), 'data/properties.json');
const historyPath = path.join(process.cwd(), 'data/history.json');

async function readJsonFile<T>(filePath: string): Promise<T[]> {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T[];
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return []; // File doesn't exist, return empty array
        }
        console.error(`Error reading or parsing JSON file at ${filePath}:`, error);
        throw new Error(`Could not read data from ${filePath}.`);
    }
}

async function writeJsonFile<T>(filePath: string, data: T[]): Promise<void> {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error writing JSON file to ${filePath}:`, error);
        throw new Error(`Could not save data to ${filePath}.`);
    }
}

export async function getDb(): Promise<Property[]> {
    return await readJsonFile<Property>(dbPath);
}

export async function getHistory(): Promise<HistoryEntry[]> {
    return await readJsonFile<HistoryEntry>(historyPath);
}

export async function savePropertiesToDb(newProperties: Property[]): Promise<void> {
    const db = await getDb();
    const updatedDb = [...db];

    newProperties.forEach(newProp => {
        // Determine if the new property is a duplicate of an existing one.
        const existingPropIndex = updatedDb.findIndex(p => {
            // Strongest check: a non-generic original_url
            if (p.original_url && p.original_url !== 'scraped-from-html' && p.original_url === newProp.original_url) {
                return true;
            }
            // Next best: a page_link extracted from the content
            if (p.page_link && newProp.page_link && p.page_link === newProp.page_link) {
                return true;
            }
            // Fallback for HTML pastes without a clear URL: title and location
            if (p.title === newProp.title && p.location === newProp.location && newProp.original_url === 'scraped-from-html') {
                return true;
            }
            return false;
        });

        if (existingPropIndex > -1) {
            // It's a duplicate, so we update the existing entry.
            // Crucially, we keep the existing property's ID to maintain data integrity.
            const originalId = updatedDb[existingPropIndex].id;
            updatedDb[existingPropIndex] = { ...newProp, id: originalId };
        } else {
            // It's a new property, add it to the start of the list.
            updatedDb.unshift(newProp);
        }
    });

    await writeJsonFile(dbPath, updatedDb);
    revalidatePath('/database');
}


export async function updatePropertyInDb(updatedProperty: Property): Promise<void> {
    const db = await getDb();
    const index = db.findIndex(p => p.id === updatedProperty.id);
    if (index > -1) {
        db[index] = updatedProperty;
        await writeJsonFile(dbPath, db);
        revalidatePath('/database');
    } else {
        throw new Error('Property not found for updating.');
    }
}


export async function deletePropertyFromDb(propertyId: string): Promise<void> {
    const db = await getDb();
    const updatedDb = db.filter(p => p.id !== propertyId);
    
    if (db.length === updatedDb.length) {
        // This could happen if called multiple times quickly. Not a critical error.
        console.warn(`Property with id ${propertyId} not found for deletion, it might have been already deleted.`);
    }

    await writeJsonFile(dbPath, updatedDb);
    revalidatePath('/database');
}


export async function saveHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'date'>): Promise<void> {
    const history = await getHistory();
    const newEntry: HistoryEntry = {
        ...entry,
        id: `hist-${Date.now()}`,
        date: new Date().toISOString()
    };
    history.unshift(newEntry);
    await writeJsonFile(historyPath, history.slice(0, 50)); // Keep history to last 50 entries
    revalidatePath('/history');
}

export async function clearDb(): Promise<void> {
    await writeJsonFile(dbPath, []);
    revalidatePath('/database');
}

export async function clearHistory(): Promise<void> {
    await writeJsonFile(historyPath, []);
    revalidatePath('/history');
}
