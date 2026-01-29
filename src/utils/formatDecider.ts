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

const DEFAULT_GOAL_MAP: Record<Platform, Partial<Record<PrimaryGoal, PostFormat[]>>> = {
    Instagram: {
        'engagement': ['Reel', 'Static'],
        'followers-growth': ['Reel', 'Carousel'],
        'traffic': ['Carousel', 'Static', 'Reel'],
        'lead-gen': ['Carousel', 'Reel', 'Static'],
        'sales': ['Carousel', 'Reel', 'Static'],
        'thought-leadership': ['Carousel', 'Live', 'Reel'],
    },
    LinkedIn: {
        'engagement': ['Static', 'Carousel'],
        'followers-growth': ['Static', 'Live'],
        'traffic': ['Carousel', 'Static'],
        'lead-gen': ['Carousel', 'Static', 'Live'],
        'sales': ['Carousel', 'Static', 'Live'],
        'thought-leadership': ['Carousel', 'Static', 'Live'],
    },
    YouTube: {
        'engagement': ['Reel', 'Static'],
        'followers-growth': ['Reel', 'Live'],
        'traffic': ['Static', 'Carousel'],
        'lead-gen': ['Live', 'Static', 'Carousel'],
        'sales': ['Live', 'Static', 'Carousel'],
        'thought-leadership': ['Live', 'Static', 'Carousel'],
    },
};

const PLATFORM_FALLBACKS: Record<Platform, PostFormat[]> = {
    Instagram: ['Static', 'Reel', 'Carousel'],
    LinkedIn: ['Static', 'Carousel'],
    YouTube: ['Live', 'Static'],
};

import { type PerformanceSignals } from './performanceAnalyzer';

/**
 * Decides the best post format based on platform, goal, and optional performance signals.
 * Now picks randomly from valid formats for fresh shuffling on every hit.
 */
export const decidePostFormat = (
    platform: Platform,
    _cohort: CohortType,
    goal: PrimaryGoal,
    _signals?: PerformanceSignals
): PostFormat => {
    // 1. Get valid formats for this platform/goal
    let validFormats = DEFAULT_GOAL_MAP[platform]?.[goal] || PLATFORM_FALLBACKS[platform];

    // 2. Pick a random one for fresh shuffling
    const randomIndex = Math.floor(Math.random() * validFormats.length);
    return validFormats[randomIndex];
};
