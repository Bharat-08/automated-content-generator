import { type Platform, type PrimaryGoal } from './platformFrequency';
export type { Platform, PrimaryGoal };
import { type CohortType } from './goalToCohort';

import { type ContentFormat } from './gtmLogic';

export type PostFormat = ContentFormat;

export interface PerformanceFormatData {
    platform: Platform;
    cohort: CohortType;
    bestFormat: PostFormat;
    score: number;
}

const DEFAULT_GOAL_MAP: Record<Platform, Partial<Record<PrimaryGoal, PostFormat>>> = {
    Instagram: {
        'Engagement/Awareness': 'Reel',
        'Leads/Sales': 'Carousel',
        'Thought Leadership': 'Carousel',
    },
    LinkedIn: {
        'Engagement/Awareness': 'Static',
        'Leads/Sales': 'Carousel',
        'Thought Leadership': 'Carousel', // Document -> Carousel
    },
    YouTube: {
        'Engagement/Awareness': 'Reel', // Short -> Reel
        'Leads/Sales': 'Live', // Video -> Live (Trust, Objections)
        'Thought Leadership': 'Live',
    },
};

const PLATFORM_FALLBACKS: Record<Platform, PostFormat> = {
    Instagram: 'Static',
    LinkedIn: 'Static',
    YouTube: 'Live',
};

import { type PerformanceSignals } from './performanceAnalyzer';

/**
 * Decides the best post format based on platform, goal, and optional performance signals.
 * 
 * @param platform - Target platform.
 * @param cohort - Content cohort.
 * @param goal - Primary goal.
 * @param signals - Optional historical performance signals.
 * @returns The selected PostFormat.
 */
export const decidePostFormat = (
    platform: Platform,
    _cohort: CohortType,
    goal: PrimaryGoal,
    signals?: PerformanceSignals
): PostFormat => {
    // 1. Check performance signals first for winning formats
    if (signals && signals.winningFormats.length > 0) {
        // Find if any winning format is a valid option for this platform's goal
        // (Simple check: if it's "Carousel" and we're on Instagram/LinkedIn, we use it)
        const topFormat = signals.winningFormats[0]; // Take the #1 winner

        if (platform === 'Instagram') {
            if (topFormat === 'Reel' || topFormat === 'Carousel' || topFormat === 'Image') return topFormat as PostFormat;
        } else if (platform === 'LinkedIn') {
            if (topFormat === 'Image' || topFormat === 'Document' || topFormat === 'Text') return topFormat as PostFormat;
        } else if (platform === 'YouTube') {
            if (topFormat === 'Short' || topFormat === 'Video') return topFormat as PostFormat;
        }
    }

    // 2. Use goal-based default mapping
    const goalFormat = DEFAULT_GOAL_MAP[platform]?.[goal];
    if (goalFormat) {
        return goalFormat;
    }

    // 3. Fallback to platform default
    return PLATFORM_FALLBACKS[platform];
};
