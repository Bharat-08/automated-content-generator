import { type Platform, type PostFormat } from './formatDecider';
import { type CohortType } from './goalToCohort';

import { type FunnelStage, type BOATPillar } from './postDerivations';

export interface ScheduledPost {
    cohort: CohortType;
    platform: Platform;
    format: PostFormat;
    date: Date;
    funnel?: FunnelStage;
    boatPillar?: BOATPillar;
    coreMessage?: string;
    postCommunication?: string;
}

/**
 * Validates a candidate post against scheduling history based on hard constraints.
 * 
 * @param candidate - The post requirement to be scheduled.
 * @param history - Already scheduled posts, sorted by date descending (newest first).
 * @returns boolean - True if all constraints are satisfied.
 */
export const validateHardConstraints = (
    candidate: { cohort: CohortType; platform: Platform; format: PostFormat; date: Date },
    history: ScheduledPost[]
): boolean => {
    if (history.length === 0) return true;

    const lastPost = history[0];
    const secondLastPost = history.length > 1 ? history[1] : null;

    // 1. No consecutive Product posts
    if (candidate.cohort === 'Product' && lastPost.cohort === 'Product') {
        return false;
    }

    // 2. No more than 2 Educational posts in a row
    if (
        candidate.cohort === 'Educational' &&
        lastPost.cohort === 'Educational' &&
        secondLastPost?.cohort === 'Educational'
    ) {
        return false;
    }

    // 3. Same format max twice consecutively
    if (
        candidate.format === lastPost.format &&
        secondLastPost?.format === candidate.format
    ) {
        return false;
    }

    // 4. No YouTube Live within 2 days
    if (candidate.platform === 'YouTube' && candidate.format === 'Live') {
        const recentYoutubeVideo = history.find(post =>
            post.platform === 'YouTube' &&
            post.format === 'Live'
        );

        if (recentYoutubeVideo) {
            const diffInDays = Math.abs(candidate.date.getTime() - recentYoutubeVideo.date.getTime()) / (1000 * 60 * 60 * 24);
            if (diffInDays < 2) {
                return false;
            }
        }
    }

    return true;
};
