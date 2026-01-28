import { type Platform, type PrimaryGoal, calculatePlatformFrequency } from './platformFrequency';
import { type PerformanceSignals } from './performanceAnalyzer';

export interface SlotConfig {
    planningMonth: string; // "YYYY-MM"
    timeframe: '2-weeks' | '1-month' | '3-months';
    primaryGoal: PrimaryGoal;
    activePlatforms: Platform[]; // Added field
    performanceSignals?: PerformanceSignals;
}

export interface GeneratedSlot {
    date: Date;
    platform: Platform;
    format: 'video' | 'text' | 'image' | 'carousel'; // Placeholder, will be refined by formatDecider
}

// Deterministic patterns for weekly distribution
// 0 = Sunday, 1 = Monday, ... 6 = Saturday
const WEEKLY_PATTERNS: Record<number, number[]> = {
    1: [2],             // 1x: Tue
    2: [1, 3],          // 2x: Mon, Wed
    3: [1, 3, 6],       // 3x: Mon, Wed, Sat (Weekend added)
    4: [1, 3, 5, 0],    // 4x: Mon, Wed, Fri, Sun (Weekend added)
    5: [1, 2, 4, 5, 6], // 5x: Mon, Tue, Thu, Fri, Sat (Weekend added)
    6: [1, 2, 3, 4, 5, 6], // 6x: Mon-Sat
    7: [0, 1, 2, 3, 4, 5, 6] // 7x: Daily
};

export const generateDateSlots = (config: SlotConfig): GeneratedSlot[] => {
    // 1. Determine Date Range
    const [year, month] = config.planningMonth.split('-').map(Number);
    // Anchor to Noon to prevent timezone shifting
    const startDate = new Date(year, month - 1, 1, 12, 0, 0);
    const endDate = new Date(startDate);

    if (config.timeframe === '2-weeks') {
        endDate.setDate(startDate.getDate() + 14 - 1);
    } else if (config.timeframe === '1-month') {
        // Go to start of next month, then subtract 1 day to get last day of current month
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(12, 0, 0);
    } else {
        // 3 months
        endDate.setMonth(startDate.getMonth() + 3);
        endDate.setDate(0);
        endDate.setHours(12, 0, 0);
    }

    // 2. Frequency Config
    // Calculate how many weeks roughly (for total count calculation internally if needed)
    // but for slot generation, we just iterate week by week.
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const timeframeWeeks = Math.ceil(daysDiff / 7);

    const frequencies = calculatePlatformFrequency({
        activePlatforms: config.activePlatforms, // Use config
        primaryGoal: config.primaryGoal,
        timeframeWeeks,
        platformWeights: config.performanceSignals?.platformWeights
    });

    const slots: GeneratedSlot[] = [];

    // 3. Generate Slots per Platform
    frequencies.forEach(freq => {
        const weeklyCount = Math.min(Math.max(freq.weeklyFrequency, 1), 7);
        const pattern = WEEKLY_PATTERNS[weeklyCount] || WEEKLY_PATTERNS[1];

        // Iterate through weeks
        // We start from startDate's week and go until we pass endDate
        // Align to previous Monday (or Sunday) but simple day iteration works fine

        const pointer = new Date(startDate);
        while (pointer <= endDate) {
            const dayOfWeek = pointer.getDay(); // 0=Sun, 1=Mon...

            if (pattern.includes(dayOfWeek)) {
                // Determine format (basic round robin or placeholder for now)
                // In real app, formatDecider does this. We just need the slot.
                slots.push({
                    date: new Date(pointer),
                    platform: freq.platform,
                    format: 'text' // strictly temporary, will be overwritten by decidePostFormat
                });
            }

            pointer.setDate(pointer.getDate() + 1);
        }
    });

    // 4. Sort by Date then Platform
    return slots.sort((a, b) => {
        const tA = a.date.getTime();
        const tB = b.date.getTime();
        if (tA !== tB) return tA - tB;
        return a.platform.localeCompare(b.platform);
    });
};
