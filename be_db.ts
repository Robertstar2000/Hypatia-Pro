
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Experiment } from './config';

// --- DATABASE SETUP (DEXIE) ---
// This class defines the structure of the local IndexedDB database.
class ExperimentDatabase extends Dexie {
    // Defines a 'table' called 'experiments' that will store Experiment objects, indexed by their string 'id'.
    experiments!: Table<Experiment, string>;

    constructor() {
        super("ProjectHypatiaDB");
        // Cast 'this' to 'any' to bypass TypeScript type definition issue with Dexie subclassing
        (this as any).version(3).stores({
            // Schema definition: 'id' is the primary key. 'title', 'createdAt', and 'updatedAt' are indexed for faster lookups.
            experiments: 'id, title, createdAt, updatedAt'
        });
    }
}

// Safer singleton instance initialization
let dbInstance: ExperimentDatabase | undefined;
try {
    dbInstance = new ExperimentDatabase();
} catch (e) {
    console.error("Critical: Failed to initialize local database.", e);
}

// Export the instance (may be undefined if init failed)
export const db = dbInstance as ExperimentDatabase;
