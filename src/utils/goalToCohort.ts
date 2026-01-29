import { type PrimaryGoal } from './platformFrequency';

export type CohortType = 'Educational' | 'Product' | 'Brand' | 'Value';

export interface GoalToCohortInput {
    primaryGoal: PrimaryGoal;
    timeframeWeeks: number;
    totalPostCount: number;
    customMix?: Record<CohortType, number>; // Re-added custom mix
}

export type CohortCounts = Record<CohortType, number>;

export const GOAL_COHORT_DISTRIBUTION: Record<PrimaryGoal, Record<CohortType, number>> = {
    'engagement': { Educational: 20, Product: 10, Brand: 40, Value: 30, },
    'followers-growth': { Educational: 10, Product: 5, Brand: 50, Value: 35, },
    'traffic': { Educational: 50, Product: 20, Brand: 15, Value: 15, },
    'lead-gen': { Educational: 40, Product: 25, Brand: 15, Value: 20, },
    'sales': { Educational: 30, Product: 45, Brand: 10, Value: 15, },
    'thought-leadership': { Educational: 60, Product: 5, Brand: 10, Value: 25, },
};

/**
 * Converts a primary goal and total post count into absolute post counts per cohort.
 * Uses a deterministic rounding strategy to ensure the total sum matches input totalPostCount.
 * 
 * @param input - The goal, timeframe, and total posts.
 * @returns A record of cohort types to their respective post counts.
 */
export const calculateGoalToCohort = (
    input: GoalToCohortInput
): CohortCounts => {
    const { primaryGoal, totalPostCount, customMix } = input;

    // Use custom mix if provided, otherwise fallback to goal-based default
    const distribution = customMix || GOAL_COHORT_DISTRIBUTION[primaryGoal];

    const cohorts = ['Educational', 'Product', 'Brand', 'Value'] as CohortType[];

    // 1. Calculate raw counts and fractional parts
    const countsWithRemainder = cohorts.map(cohort => {
        const percentage = distribution[cohort] || 0;
        const raw = (percentage / 100) * totalPostCount;
        return {
            cohort,
            count: Math.floor(raw),
            remainder: raw - Math.floor(raw)
        };
    });

    // 2. Sum of floored counts
    const currentTotal = countsWithRemainder.reduce((sum, item) => sum + item.count, 0);
    let missing = totalPostCount - currentTotal;

    // 3. Distribute missing counts to those with largest remainders
    // Sort by remainder descending
    countsWithRemainder.sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < missing; i++) {
        countsWithRemainder[i].count += 1;
    }

    // 4. Return as record and maintain original cohort order if possible
    const result: Partial<CohortCounts> = {};
    countsWithRemainder.forEach(item => {
        result[item.cohort] = item.count;
    });

    return result as CohortCounts;
};
