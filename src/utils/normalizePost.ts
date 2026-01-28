import { type ScheduledPost } from './hardConstraints';
import { type BrandProfile } from './aiGenerator';
import { type PrimaryGoal, type Platform } from './platformFrequency';
import { type PostFormat } from './formatDecider';
import { type CohortType } from './goalToCohort';
import { type FunnelStage, type BOATPillar, mapCohortToFunnel, mapCohortToBoatPillar } from './postDerivations';

export interface NormalizedPost {
    id: string;
    date: string;
    platform: Platform;
    funnel: FunnelStage;
    cohort: CohortType;
    boatPillar: BOATPillar;
    format: PostFormat;
    coreMessage: string;
    postCommunication: string;
    goalFocus: string;
}

/**
 * Normalizes a scheduled post by ensuring all fields are present and populating content via AI.
 */
export const assembleFullPost = (
    scheduled: ScheduledPost,
    brand: BrandProfile,
    goal: PrimaryGoal
): NormalizedPost => {
    // Determine if we need to generate new content or use existing
    let coreMessage = scheduled.coreMessage;
    let postCommunication = scheduled.postCommunication;

    if (!coreMessage || !postCommunication) {
        // Content not yet generated
        coreMessage = coreMessage || '';
        postCommunication = postCommunication || '';
    }

    return {
        id: `post-${scheduled.date.getTime()}-${scheduled.platform}-${scheduled.cohort}`,
        date: scheduled.date.toISOString().split('T')[0],
        platform: scheduled.platform,
        funnel: scheduled.funnel || mapCohortToFunnel(scheduled.cohort),
        cohort: scheduled.cohort,
        boatPillar: scheduled.boatPillar || mapCohortToBoatPillar(scheduled.cohort),
        format: scheduled.format,
        coreMessage: coreMessage,
        postCommunication: postCommunication,
        goalFocus: goal.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    };
};

/**
 * Normalizes an entire calendar of scheduled posts.
 */
export const normalizeCalendar = (
    calendar: ScheduledPost[],
    brand: BrandProfile,
    goal: PrimaryGoal
): NormalizedPost[] => {
    return calendar.map(post => assembleFullPost(post, brand, goal));
};
