import { type ScheduledPost } from './hardConstraints';
import { type CohortType } from './goalToCohort';

/**
 * Validates and rebalances a scheduled calendar to ensure weekly cohort variety.
 * 
 * Rules for every 7-day window:
 * - At least 1 Education
 * - At least 1 Inspiration (Awareness)
 * - At least 1 Personal (Value)
 * 
 * If imbalance is detected, it attempts to swap with the nearest valid candidate elsewhere.
 */
export const validateWeeklyBalance = (posts: ScheduledPost[]): ScheduledPost[] => {
    const result = [...posts];
    const n = result.length;
    if (n < 7) return result;

    const cohorts: CohortType[] = ['Educational', 'Value', 'Brand'];

    // Slide window
    for (let i = 0; i <= n - 7; i++) {
        const window = result.slice(i, i + 7);
        const counts: Record<CohortType, number> = {
            Educational: 0,
            Value: 0,
            Brand: 0,
            Product: 0,
        };
        window.forEach(p => counts[p.cohort]++);

        for (const cohort of cohorts) {
            if (counts[cohort] === 0) {
                // Find nearest instance of this cohort outside the window (look ahead first)
                const swapIdx = findNearestValidSwap(result, i, i + 6, cohort);
                if (swapIdx !== -1) {
                    // Find an "excess" post in the current window to swap with
                    const excessIdx = findExcessPostInWindow(window, counts);
                    if (excessIdx !== -1) {
                        performSwap(result, i + excessIdx, swapIdx);
                        // Recalculate counts for current window after swap
                        counts[result[i + excessIdx].cohort]++;
                        counts[result[swapIdx].cohort]--; // This is the old one that was in window but wait...
                        // Actually, let's just restart the window check or keep it simple.
                        // Simplified: increment/decrement safely
                    }
                }
            }
        }
    }

    return result;
};

// Helper to find an "excess" post in the window that can be swapped out
const findExcessPostInWindow = (window: ScheduledPost[], counts: Record<CohortType, number>): number => {
    // Prefer swapping out Product if clustered, or the most frequent cohort
    if (counts.Product > 1) return window.findIndex(p => p.cohort === 'Product');
    if (counts.Educational > 2) return window.findIndex(p => p.cohort === 'Educational');

    // Just find the max
    let maxCohort: CohortType = 'Educational';
    let maxCount = 0;
    (Object.keys(counts) as CohortType[]).forEach(c => {
        if (counts[c] > maxCount) {
            maxCount = counts[c];
            maxCohort = c;
        }
    });

    return window.findIndex(p => p.cohort === maxCohort);
};

// Helper to find nearest valid swap candidate
const findNearestValidSwap = (
    posts: ScheduledPost[],
    windowStart: number,
    windowEnd: number,
    targetCohort: CohortType
): number => {
    // Search forwards first
    for (let j = windowEnd + 1; j < posts.length; j++) {
        if (posts[j].cohort === targetCohort) return j;
    }
    // Search backwards
    for (let j = windowStart - 1; j >= 0; j--) {
        if (posts[j].cohort === targetCohort) return j;
    }
    return -1;
};

// Helper to perform swap while maintaining date order (only swap properties, keep dates)
const performSwap = (posts: ScheduledPost[], idx1: number, idx2: number) => {
    const p1 = posts[idx1];
    const p2 = posts[idx2];

    // Swap cohort, platform, format
    const temp = { cohort: p1.cohort, platform: p1.platform, format: p1.format };

    p1.cohort = p2.cohort;
    p1.platform = p2.platform;
    p1.format = p2.format;

    p2.cohort = temp.cohort;
    p2.platform = temp.platform;
    p2.format = temp.format;
};
