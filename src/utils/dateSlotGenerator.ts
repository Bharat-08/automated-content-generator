import { type Platform, type PrimaryGoal } from './platformFrequency';
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

// Deterministic patterns removed - switched to Daily Cycle Strategy
// 0 = Sunday, 1 = Monday, ... 6 = Saturday

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

    const slots: GeneratedSlot[] = [];
    const platforms = config.activePlatforms.length > 0 ? config.activePlatforms : ['LinkedIn'] as Platform[];

    // 2. Simple Daily Loop (User Requested "Plan on all days")
    const pointer = new Date(startDate);
    let platformIndex = 0;

    while (pointer <= endDate) {
        // Round-robin distribution of platforms
        const platform = platforms[platformIndex % platforms.length];

        slots.push({
            date: new Date(pointer),
            platform: platform,
            format: 'text'
        });

        // Advance
        pointer.setDate(pointer.getDate() + 1);
        platformIndex++;
    }

    // 3. Sort
    return slots;
};
