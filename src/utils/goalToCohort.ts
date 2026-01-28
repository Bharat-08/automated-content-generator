import { type PrimaryGoal } from './platformFrequency';

export type CohortType = 'Educational' | 'Product' | 'Brand' | 'Community';

export interface GoalToCohortInput {
    primaryGoal: PrimaryGoal;
    timeframeWeeks: number;
    totalPostCount: number;
}

export type CohortCounts = Record<CohortType, number>;

const GOAL_COHORT_DISTRIBUTION: Record<PrimaryGoal, Record<CohortType, number>> = {
    'Engagement/Awareness': {
        Educational: 20,
        Product: 10,
        Brand: 40,
        Community: 30,
    },
    'Leads/Sales': {
        Educational: 40,
        Product: 25,
        Brand: 15,
        Community: 20,
    },
    'Thought Leadership': {
        Educational: 60,
        Product: 5,
        Brand: 10,
        Community: 25,
    },
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
    const { primaryGoal, totalPostCount } = input;
    const distribution = GOAL_COHORT_DISTRIBUTION[primaryGoal];

    const cohorts = Object.keys(distribution) as CohortType[];

    // 1. Calculate raw counts and fractional parts
    const countsWithRemainder = cohorts.map(cohort => {
        const raw = (distribution[cohort] / 100) * totalPostCount;
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
