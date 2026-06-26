/**
 * Local Template Service
 * Handles all template and invoice operations locally for offline app
 * Uses localStorage for invoice/template storage, local files for template data
 */

import { invoiceRepository } from '../data/repositories';
import { MAX_INVOICES } from '../data/repositories/invoice-repository';
import type { SavedInvoice as DbSavedInvoice, UserTemplate as DbUserTemplate } from '../data/types';

// Types
export interface ColorVariant {
    id: number;
    image: string;
    dataPath: string;
    hex: string;
}

export interface TemplateMeta {
    id: number | string;
    name: string;
    description: string;
    type: string;
    device: 'mobile' | 'tablet' | 'desktop';
    image: string;
    isPremium: boolean;
    price: { [key: string]: number };
    hashtags?: string[];
    // Color variant support
    hasColorVariants?: boolean;
    colorVariants?: Record<string, ColorVariant>;
    defaultColor?: string;
}

export interface TemplateData {
    msc: any;
    footers: any[];
    appMapping: any;
}

// Invoice item for items array
export interface InvoiceItem {
    rowNumber: number;
    cells: { [columnName: string]: string | number | null };
}

// Form details for From and BillTo
export interface InvoiceFormDetails {
    [fieldName: string]: string | null;
}

export interface UserTemplate extends TemplateMeta {
    data: TemplateData;
    importedAt: string;
    selectedColor?: string; // Track which color was imported
}

export interface SavedInvoice {
    id: string;
    name: string;
    templateId: string | number;
    content: string;
    billType: number;
    createdAt: string;
    modifiedAt: string;
    total?: number | null;
    // New metadata fields
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    fromDetails?: InvoiceFormDetails | null;
    billToDetails?: InvoiceFormDetails | null;
    items?: InvoiceItem[] | null;
}

// Non-color-variant template IDs (100001-100003 are the ones that actually exist)
const STANDALONE_TEMPLATE_IDS = [100001, 100002, 100003];

// Color variant base template IDs (none currently exist - keeping empty array for future use)
const COLOR_VARIANT_BASE_IDS: number[] = [];

// Combined template IDs for display (standalone + consolidated color variants)
const ALL_TEMPLATE_IDS = [...STANDALONE_TEMPLATE_IDS, ...COLOR_VARIANT_BASE_IDS];

const BUILT_IN_TEMPLATE_META: Record<number, TemplateMeta> = {
    100001: {
        id: 100001,
        name: 'Balance Sheet',
        description: 'iPad balance sheet workbook',
        type: 'balance-sheet',
        device: 'tablet',
        image: '/favicon.png',
        isPremium: false,
        price: { USD: 0 },
    },
    100002: {
        id: 100002,
        name: 'Balance Sheet',
        description: 'iPhone balance sheet workbook',
        type: 'balance-sheet',
        device: 'mobile',
        image: '/favicon.png',
        isPremium: false,
        price: { USD: 0 },
    },
    100003: {
        id: 100003,
        name: 'Balance Sheet',
        description: 'Desktop balance sheet workbook',
        type: 'balance-sheet',
        device: 'desktop',
        image: '/favicon.png',
        isPremium: false,
        price: { USD: 0 },
    },
};

function getBuiltInTemplateMeta(id: number): TemplateMeta | null {
    return BUILT_IN_TEMPLATE_META[id] ?? null;
}

/**
 * Fetch template metadata from local public folder
 */
async function fetchTemplateMeta(id: number): Promise<TemplateMeta | null> {
    try {
        const response = await fetch(`/templates/meta/${id}-meta.json`);
        if (!response.ok) return getBuiltInTemplateMeta(id);
        const text = await response.text();
        if (!text.trim()) return getBuiltInTemplateMeta(id);
        const meta = JSON.parse(text) as TemplateMeta;
        return meta?.id != null ? meta : getBuiltInTemplateMeta(id);
    } catch (error) {
        console.error(`Error fetching template meta ${id}:`, error);
        return getBuiltInTemplateMeta(id);
    }
}

/**
 * Fetch consolidated template metadata (for color variant templates)
 */
async function fetchConsolidatedMeta(id: number): Promise<TemplateMeta | null> {
    try {
        const response = await fetch(`/templates/meta-consolidated/${id}-meta.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching consolidated template meta ${id}:`, error);
        return null;
    }
}

/**
 * Fetch template data from local public folder
 */
async function fetchTemplateData(id: number): Promise<TemplateData | null> {
    try {
        const response = await fetch(`/templates/data/${id}.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching template data ${id}:`, error);
        return null;
    }
}

export const localTemplateService = {
    /**
     * Fetch all available store templates (metadata only for listing)
     */
    async fetchStoreTemplates(page: number = 1, limit: number = 10): Promise<{ items: TemplateMeta[], pagination: { total: number, page: number, limit: number } }> {
        const templateIds = ALL_TEMPLATE_IDS;
        const templates: TemplateMeta[] = [];

        for (const id of templateIds) {
            const meta = await fetchTemplateMeta(id);
            if (meta) templates.push(meta);
        }

        return {
            items: templates,
            pagination: {
                total: templates.length,
                page: 1,
                limit: 10
            }
        };
    },

    /**
     * Fetch a specific store template with full data
     */
    async fetchStoreTemplate(id: number | string): Promise<{ meta: TemplateMeta, data: TemplateData } | null> {
        const numId = Number(id);

        if (!ALL_TEMPLATE_IDS.includes(numId)) {
            console.error(`Unknown template id: ${id}`);
            return null;
        }

        const meta = await fetchTemplateMeta(numId);
        const rawTemplate = await fetchTemplateData(numId);

        if (!meta || !rawTemplate) {
            console.error(`Failed to load template ${id}`);
            return null;
        }

        const data: TemplateData = {
            msc: rawTemplate.msc ?? rawTemplate,
            footers: rawTemplate.footers ?? [],
            appMapping: rawTemplate.appMapping ?? {}
        };

        return { meta, data };
    },

    /**
     * Get user's imported templates from localStorage
     */
    async getUserTemplates(): Promise<UserTemplate[]> {
        return [];
    },

    /**
     * Save a user template to localStorage
     */
    async saveUserTemplate(template: UserTemplate): Promise<boolean> {
        return true;
    },

    /**
     * Import a store template to user's collection
     */
    async importTemplate(storeTemplateId: number | string, customName: string, selectedColor?: string): Promise<boolean> {
        return true;
    },

    /**
     * Get a user template by ID
     */
    async getUserTemplate(id: string): Promise<UserTemplate | null> {
        return null;
    },

    /**
     * Delete a user template
     */
    async deleteUserTemplate(id: string): Promise<boolean> {
        try {
            return await invoiceRepository.deleteUserTemplate(id);
        } catch (error) {
            console.error('Error deleting user template:', error);
            return false;
        }
    },

    /**
     * Update user template metadata
     */
    async updateUserTemplateMeta(id: string, updates: Partial<TemplateMeta>): Promise<boolean> {
        try {
            // For now, just update selectedColor if provided
            if ('selectedColor' in updates) {
                return await invoiceRepository.updateUserTemplateMeta(id, { selectedColor: updates.selectedColor as string });
            }
            return true;
        } catch (error) {
            console.error('Error updating user template:', error);
            return false;
        }
    },

    /**
     * Get all saved invoices from localStorage
     */
    async getSavedInvoices(): Promise<SavedInvoice[]> {
        try {
            const dbInvoices = await invoiceRepository.getAllInvoices();
            return dbInvoices.map(inv => ({
                id: inv.id,
                name: inv.name,
                templateId: inv.templateId,
                content: inv.content,
                billType: inv.billType,
                createdAt: inv.createdAt,
                modifiedAt: inv.modifiedAt,
                total: inv.total,
                invoiceNumber: inv.invoiceNumber,
                invoiceDate: inv.invoiceDate,
                fromDetails: inv.fromDetails,
                billToDetails: inv.billToDetails,
                items: inv.items
            }));
        } catch (error) {
            console.error('Error reading saved invoices:', error);
            return [];
        }
    },

    /**
     * Get a specific invoice by filename/ID
     */
    async getInvoice(id: string): Promise<SavedInvoice | null> {
        try {
            const dbInvoice = await invoiceRepository.getInvoiceById(id);
            if (!dbInvoice) {
                // Try to find by name
                const allInvoices = await this.getSavedInvoices();
                return allInvoices.find(inv => inv.name === id) || null;
            }
            return {
                id: dbInvoice.id,
                name: dbInvoice.name,
                templateId: dbInvoice.templateId,
                content: dbInvoice.content,
                billType: dbInvoice.billType,
                createdAt: dbInvoice.createdAt,
                modifiedAt: dbInvoice.modifiedAt,
                total: dbInvoice.total,
                invoiceNumber: dbInvoice.invoiceNumber,
                invoiceDate: dbInvoice.invoiceDate,
                fromDetails: dbInvoice.fromDetails,
                billToDetails: dbInvoice.billToDetails,
                items: dbInvoice.items
            };
        } catch (error) {
            console.error('Error getting invoice:', error);
            return null;
        }
    },

    /**
     * Save an invoice to localStorage
     */
    async saveInvoice(invoice: Omit<SavedInvoice, 'createdAt' | 'modifiedAt'> & { id?: string }): Promise<boolean> {
        try {
            return await invoiceRepository.saveInvoice({
                id: invoice.id || `invoice_${Date.now()}`,
                name: invoice.name,
                templateId: String(invoice.templateId),
                content: invoice.content,
                billType: invoice.billType || 0,
                total: invoice.total,
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate,
                fromDetails: invoice.fromDetails,
                billToDetails: invoice.billToDetails,
                items: invoice.items
            });
        } catch (error) {
            console.error('Error saving invoice:', error);
            return false;
        }
    },

    /**
     * Delete an invoice
     */
    async deleteInvoice(id: string): Promise<boolean> {
        try {
            return await invoiceRepository.deleteInvoice(id);
        } catch (error) {
            console.error('Error deleting invoice:', error);
            return false;
        }
    },

    /**
     * Check if an invoice exists
     */
    async invoiceExists(id: string): Promise<boolean> {
        try {
            return await invoiceRepository.invoiceExists(id);
        } catch (error) {
            console.error('Error checking invoice:', error);
            return false;
        }
    },

    /**
     * Check if user can create a new invoice (8-file limit)
     */
    async canCreateInvoice(): Promise<boolean> {
        return invoiceRepository.canCreateInvoice();
    },

    /**
     * Get current invoice count
     */
    async getInvoiceCount(): Promise<number> {
        return invoiceRepository.countInvoices();
    },

    /**
     * Maximum invoices allowed
     */
    maxInvoices: MAX_INVOICES,

    /**
     * Set the active template ID
     */
    async setActiveTemplateId(id: number | string): Promise<void> {
        localStorage.setItem('balance-sheet-active-template-id', String(id));
    },

    /**
     * Get the active template ID
     */
    async getActiveTemplateId(): Promise<number | string | null> {
        const id = localStorage.getItem('balance-sheet-active-template-id');
        if (!id) return null;
        return isNaN(Number(id)) ? id : Number(id);
    },

    /**
     * Clear active template ID
     */
    async clearActiveTemplateId(): Promise<void> {
        localStorage.removeItem('balance-sheet-active-template-id');
    }
};

export default localTemplateService;
