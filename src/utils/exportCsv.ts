import { type NormalizedPost } from './normalizePost';
import { type CohortType } from './goalToCohort';
import { type FunnelStage } from './gtmLogic';
import * as XLSX from 'xlsx';

/**
 * Transforms posts into a flat array of objects matching the export columns.
 */
const transformForCalendar = (posts: NormalizedPost[]) => {
    return posts.map(p => ({
        'Date': p.date,
        'Funnel': p.funnel,
        'Cohort': p.cohort,
        'BOAT Pillar': p.boatPillar,
        'Format': p.format,
        'Core Message': p.coreMessage || '',
        'Post Communication': p.postCommunication || '',
        'Reference links': '' // Placeholder as per requirements
    }));
};

/**
 * Creates the pivot data for the Distribution Audit sheet.
 * Structure: Funnel | Cohort | Carousel | Live | Reel | Static | Grand Total
 */
const createPivotData = (posts: NormalizedPost[]) => {
    const pivotMap: Record<string, {
        funnel: FunnelStage;
        cohort: CohortType;
        counts: Record<string, number>;
        total: number;
    }> = {};

    posts.forEach(p => {
        const key = `${p.funnel}-${p.cohort}`;
        if (!pivotMap[key]) {
            pivotMap[key] = {
                funnel: p.funnel,
                cohort: p.cohort,
                counts: { Carousel: 0, Live: 0, Reel: 0, Static: 0 },
                total: 0
            };
        }

        // Count format
        const formatKey = p.format;
        pivotMap[key].counts[formatKey] = (pivotMap[key].counts[formatKey] || 0) + 1;
        pivotMap[key].total += 1;
    });

    // Convert to array
    const rows = Object.values(pivotMap).map(row => ({
        'Funnel': row.funnel,
        'Cohort': row.cohort,
        'Carousel': row.counts.Carousel || 0,
        'Live': row.counts.Live || 0,
        'Reel': row.counts.Reel || 0,
        'Static': row.counts.Static || 0, // Added Static as it's a valid format
        'Grand Total': row.total
    }));

    // Add Grand Total Row
    const grandTotal = rows.reduce((acc, r) => ({
        'Funnel': 'Total',
        'Cohort': '',
        'Carousel': acc.Carousel + r.Carousel,
        'Live': acc.Live + r.Live,
        'Reel': acc.Reel + r.Reel,
        'Static': acc['Static'] + r['Static'],
        'Grand Total': acc['Grand Total'] + r['Grand Total']
    }), { 'Funnel': 'Total', 'Cohort': '', 'Carousel': 0, 'Live': 0, 'Reel': 0, 'Static': 0, 'Grand Total': 0 });

    rows.push(grandTotal);

    return rows;
};

/**
 * Exports content to CSV or XLSX
 */
export const exportContent = (posts: NormalizedPost[], format: 'csv' | 'xlsx', filenameBase: string) => {
    if (!posts || posts.length === 0) {
        console.warn('Export: No data provided');
        return;
    }

    const calendarData = transformForCalendar(posts);
    const pivotData = createPivotData(posts);
    const filename = `${filenameBase}.${format}`;

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Calendar
    const sheet1 = XLSX.utils.json_to_sheet(calendarData);
    XLSX.utils.book_append_sheet(workbook, sheet1, 'Start Here');

    // Sheet 2: Distribution Audit
    const sheet2 = XLSX.utils.json_to_sheet(pivotData);
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Distribution Audit');

    if (format === 'csv') {
        // Warning: CSV only supports one sheet. We will export the Calendar sheet mainly.
        // Or we could zip them, but standard requirement implies XLSX for multi-sheet.
        // If CSV is requested, we just dump the Calendar.
        const csvOutput = XLSX.utils.sheet_to_csv(sheet1);
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
        XLSX.writeFile(workbook, filename);
    }
};

/**
 * Legacy wrapper for backward compatibility if needed, defaulting to XLSX for better multi-sheet support
 */
export const exportPostsToCSV = (posts: NormalizedPost[], filename: string) => {
    // Force XLSX if filename suggests it, or if we want multi-sheet
    if (filename.endsWith('.xlsx')) {
        exportContent(posts, 'xlsx', filename.replace('.xlsx', ''));
    } else {
        exportContent(posts, 'csv', filename.replace('.csv', ''));
    }
};
