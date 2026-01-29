export type Platform = 'Instagram' | 'LinkedIn' | 'YouTube';

export type PrimaryGoal =
    | 'engagement'
    | 'followers-growth'
    | 'traffic'
    | 'lead-gen'
    | 'sales'
    | 'thought-leadership';

export interface FrequencyInput {
    activePlatforms: Platform[];
    primaryGoal: PrimaryGoal;
    timeframeWeeks: number;
    platformWeights?: Record<string, number>; // From CSV analysis
}

export interface PlatformFrequencyResult {
    platform: Platform;
    weeklyFrequency: number;
    totalPostCount: number;
}

const BASE_WEEKLY_FREQUENCY: Record<Platform, number> = {
    Instagram: 3,
    LinkedIn: 2,
    YouTube: 1,
};

const GOAL_BOOSTS: Record<PrimaryGoal, Partial<Record<Platform, number>>> = {
    'engagement': { Instagram: 1, YouTube: 1 },
    'followers-growth': { Instagram: 1, LinkedIn: 1 },
    'traffic': { LinkedIn: 1, Instagram: 1 },
    'lead-gen': { LinkedIn: 1, Instagram: 1 },
    'sales': { LinkedIn: 1, Instagram: 1 },
    'thought-leadership': { LinkedIn: 1, YouTube: 1 },
};

/**
 * Calculates the posting frequency and total post count per platform based on 
 * the active platforms, primary goal, and timeframe.
 * 
 * @param input - The configuration including active platforms, goal, and timeframe in weeks.
 * @returns An array of frequency results for each active platform.
 */
export const calculatePlatformFrequency = (
    input: FrequencyInput
): PlatformFrequencyResult[] => {
    const { activePlatforms, primaryGoal, timeframeWeeks, platformWeights } = input;
    const boosts = GOAL_BOOSTS[primaryGoal];

    return activePlatforms.map((platform) => {
        const base = BASE_WEEKLY_FREQUENCY[platform];
        const boost = boosts[platform] || 0;
        let weeklyFrequency = base + boost;

        // Apply biased weighting from CSV if present
        if (platformWeights && platformWeights[platform]) {
            // e.g. weight 1.5 -> +50% freq
            weeklyFrequency = Math.round(weeklyFrequency * platformWeights[platform]);
        }

        // Ensure at least 1 post/week if it's active
        weeklyFrequency = Math.max(1, weeklyFrequency);

        const totalPostCount = weeklyFrequency * timeframeWeeks;

        return {
            platform,
            weeklyFrequency,
            totalPostCount,
        };
    });
};
