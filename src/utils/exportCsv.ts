import { type NormalizedPost } from './normalizePost';
import * as XLSX from 'xlsx';

/**
 * Exports content to CSV or XLSX
 */
export const exportContent = (posts: NormalizedPost[], filenameBase: string, format: 'csv' | 'xlsx' = 'csv') => {
    if (!posts || posts.length === 0) {
        console.warn('Export: No data provided');
        return;
    }

    // 1. Sort Chronologically
    const sortedPosts = [...posts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Transform into required columns
    const exportData = sortedPosts.map(p => ({
        'Date': p.date,
        'Funnel': p.funnel,
        'Cohort': p.cohort,
        'Pillar': p.boatPillar,
        'Format': p.format,
        'Core Message': p.coreMessage || '',
        'Communication': p.postCommunication || '',
        'Platform': p.platform
    }));

    const filename = `${filenameBase}.${format}`;
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    if (format === 'csv') {
        // 3. Convert to CSV using XLSX utility
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

        // 4. Trigger Download
        const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } else {
        // XLSX handling
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Content Schedule');
        XLSX.writeFile(workbook, filename);
    }
};

/**
 * Simplified wrapper for CSV/XLSX export
 */
export const exportPostsToCSV = (posts: NormalizedPost[], filename: string) => {
    const isExcel = filename.endsWith('.xlsx');
    const base = filename.replace('.csv', '').replace('.xlsx', '');
    exportContent(posts, base, isExcel ? 'xlsx' : 'csv');
};
