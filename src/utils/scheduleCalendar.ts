import { type Platform, type PrimaryGoal, type PostFormat } from './formatDecider';
import { type CohortType } from './goalToCohort';
import { type ScheduledPost, validateHardConstraints } from './hardConstraints';
import { scoreCandidate } from './scoreCandidate';
import { mapCohortToFunnel, mapCohortToBoatPillar } from './postDerivations';

export interface UnscheduledRequirement {
    cohort: CohortType;
    platform: Platform;
    format: PostFormat;
}

/**
 * Orchestrates the scheduling loop over a date range.
 * 
 * @param startDate - Start of the scheduling period.
 * @param endDate - End of the scheduling period.
 * @param requirements - List of unscheduled requirements (cohort, platform, format).
 * @param goal - Primary goal for scoring.
 * @returns Fully scheduled post array.
 */
export const scheduleCalendar = (
    startDate: Date,
    endDate: Date,
    requirements: UnscheduledRequirement[],
    goal: PrimaryGoal,
    initialHistory: ScheduledPost[] = []
): ScheduledPost[] => {
    const scheduledPosts = [...initialHistory];
    const remainingRequirements = [...requirements];

    // Clone start date to avoid mutation
    const currentDate = new Date(startDate);

    // Iterate through each day in the range
    while (currentDate <= endDate) {
        // Try to fill platform slots for this day as long as requirements stay
        let foundCandidateForDay = true;

        while (foundCandidateForDay && remainingRequirements.length > 0) {
            foundCandidateForDay = false;

            // Get scheduled platforms for TODAY to avoid multiple posts on same platform
            const dateStr = currentDate.toISOString().split('T')[0];
            const platformsToday = scheduledPosts
                .filter(p => p.date.toISOString().split('T')[0] === dateStr)
                .map(p => p.platform);

            const validCandidates = remainingRequirements
                .map((req, index) => ({ ...req, index }))
                .filter(candidate => {
                    // Rule: One post per platform per day
                    if (platformsToday.includes(candidate.platform)) return false;

                    const candidatePost: ScheduledPost = {
                        ...candidate,
                        date: new Date(currentDate)
                    };
                    // 2. Filter via hard constraints
                    const history = [...scheduledPosts].reverse();
                    return validateHardConstraints(candidatePost, history);
                });

            if (validCandidates.length > 0) {
                // 3. Score remaining candidates
                const scoredCandidates = validCandidates.map(candidate => {
                    const candidatePost: ScheduledPost = {
                        ...candidate,
                        date: new Date(currentDate)
                    };
                    const history = [...scheduledPosts].reverse();
                    const score = scoreCandidate(candidatePost, { primaryGoal: goal, recentHistory: history });
                    return { ...candidate, score };
                });

                // 4. Select highest score
                scoredCandidates.sort((a, b) => b.score - a.score);
                const bestCandidate = scoredCandidates[0];

                // 5. Assign post to date with derivations
                scheduledPosts.push({
                    cohort: bestCandidate.cohort,
                    platform: bestCandidate.platform,
                    format: bestCandidate.format,
                    date: new Date(currentDate),
                    funnel: mapCohortToFunnel(bestCandidate.cohort),
                    boatPillar: mapCohortToBoatPillar(bestCandidate.cohort)
                });

                // 6. Update remaining counts
                remainingRequirements.splice(bestCandidate.index, 1);

                // Set flag to try finding another post for a DIFFERENT platform today
                foundCandidateForDay = true;
            }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[Scheduler] Total posts scheduled: ${scheduledPosts.length - initialHistory.length} across ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return scheduledPosts;
};
