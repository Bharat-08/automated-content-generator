import { type Platform, type PostFormat } from './formatDecider';
import { type CohortType } from './goalToCohort';

import { type FunnelStage, type BOATPillar, mapCohortToBoatPillar } from './postDerivations';

export interface ScheduledPost {
    id?: string;
    cohort: CohortType;
    platform: Platform;
    format: PostFormat;
    date: Date;
    funnel?: FunnelStage;
    boatPillar?: BOATPillar;
    coreMessage?: string;
    postCommunication?: string;
    event?: string; // e.g. "Valentine's Day"
}

/**
 * Validates a candidate post against scheduling history based on hard constraints.
 * 
 * @param candidate - The post requirement to be scheduled.
 * @param history - Already scheduled posts, sorted by date descending (newest first).
 * @returns boolean - True if all constraints are satisfied.
 */
export const validateHardConstraints = (
    candidate: { cohort: CohortType; platform: Platform; format: PostFormat; date: Date; boatPillar?: BOATPillar },
    history: ScheduledPost[]
): boolean => {
    if (history.length === 0) return true;

    const lastPost = history[0];
    const secondLastPost = history.length > 1 ? history[1] : null;

    // 1. Specific rule: No consecutive Product posts (Stricter than generic)
    if (candidate.cohort === 'Product' && lastPost.cohort === 'Product') {
        return false;
    }

    // 2. Generic rule: No more than 2 identical Cohorts in a row
    if (
        candidate.cohort === lastPost.cohort &&
        secondLastPost?.cohort === candidate.cohort
    ) {
        return false;
    }

    // 3. Generic rule: No more than 2 identical Pillars in a row
    const candidatePillar = candidate.boatPillar || mapCohortToBoatPillar(candidate.cohort);
    const lastPostPillar = lastPost.boatPillar || mapCohortToBoatPillar(lastPost.cohort);
    const secondLastPostPillar = secondLastPost ? (secondLastPost.boatPillar || mapCohortToBoatPillar(secondLastPost.cohort)) : null;

    if (
        candidatePillar === lastPostPillar &&
        secondLastPostPillar === candidatePillar
    ) {
        return false;
    }

    // 4. Same format max twice consecutively
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
