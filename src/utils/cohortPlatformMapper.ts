import { type Platform, type PlatformFrequencyResult } from './platformFrequency';
import { type CohortType, type CohortCounts } from './goalToCohort';

export interface PostRequirement {
    cohort: CohortType;
    platform: Platform;
}

export interface PastPerformanceEntry {
    cohort: CohortType;
    platform: Platform;
    score: number; // e.g., engagement rate or conversion score
}

const FIT_SCORES: Record<CohortType, Record<Platform, number>> = {
    Educational: {
        LinkedIn: 5,
        YouTube: 4,
        Instagram: 2,
    },
    Product: {
        Instagram: 5,
        LinkedIn: 4,
        YouTube: 2,
    },
    Brand: {
        Instagram: 5,
        LinkedIn: 3,
        YouTube: 2,
    },
    Community: {
        Instagram: 5,
        YouTube: 4,
        LinkedIn: 2,
    },
};

/**
 * Maps cohort requirements to platforms based on fit scores, capacity, and past performance.
 * 
 * @param cohortCounts - Number of posts required per cohort.
 * @param platformFrequencies - Available slots per platform.
 * @param pastPerformance - Optional historical data to adjust scoring.
 * @returns A list of unassigned post requirements.
 */
export const mapCohortsToPlatforms = (
    cohortCounts: CohortCounts,
    platformFrequencies: PlatformFrequencyResult[],
    pastPerformance?: PastPerformanceEntry[]
): PostRequirement[] => {
    const requirements: PostRequirement[] = [];

    // 1. Initialize available slots
    const availableSlots: Record<Platform, number> = {} as any;
    platformFrequencies.forEach(pf => {
        availableSlots[pf.platform] = pf.totalPostCount;
    });

    // 2. Create a prioritized list of cohort requirements
    // (We'll process cohorts with fewer high-fit options first, or just iterate)
    const cohortTypes = Object.keys(cohortCounts) as CohortType[];

    // Flatten requirements into a list: [{type: 'Education'}, {type: 'Education'}, ...]
    const pendingPosts: CohortType[] = [];
    cohortTypes.forEach(cohort => {
        for (let i = 0; i < cohortCounts[cohort]; i++) {
            pendingPosts.push(cohort);
        }
    });

    // 3. Greedy assignment
    pendingPosts.forEach(cohort => {
        // Rank platforms by fit score + performance bonus
        const platformScores = (Object.keys(FIT_SCORES[cohort]) as Platform[])
            .filter(platform => availableSlots[platform] !== undefined) // Only active platforms
            .map(platform => {
                let score = FIT_SCORES[cohort][platform];

                // Add performance bonus if available
                if (pastPerformance) {
                    const perf = pastPerformance.find(p => p.cohort === cohort && p.platform === platform);
                    if (perf) {
                        score += perf.score;
                    }
                }

                return { platform, score };
            })
            .sort((a, b) => b.score - a.score);

        // Find the best available platform
        const bestPlatform = platformScores.find(ps => availableSlots[ps.platform] > 0);

        if (bestPlatform) {
            requirements.push({ cohort, platform: bestPlatform.platform });
            availableSlots[bestPlatform.platform] -= 1;
        } else {
            // Fallback: This shouldn't happen if totalPostCount matches sum of cohortCounts
            // But we find any platform with slots
            const fallbackPlatform = (Object.keys(availableSlots) as Platform[])
                .find(p => availableSlots[p] > 0);

            if (fallbackPlatform) {
                requirements.push({ cohort, platform: fallbackPlatform });
                availableSlots[fallbackPlatform] -= 1;
            }
        }
    });

    return requirements;
};
