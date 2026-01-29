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
    // SHUFFLE requirements to ensure visible diversity from the start
    const remainingRequirements = [...requirements];
    for (let i = remainingRequirements.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingRequirements[i], remainingRequirements[j]] = [remainingRequirements[j], remainingRequirements[i]];
    }

    // Clone start date to avoid mutation
    const currentDate = new Date(startDate);

    // Track last assigned to penalize in scoring
    let lastAssigned: ScheduledPost | undefined = initialHistory.length > 0 ? initialHistory[initialHistory.length - 1] : undefined;

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
                    // KEY FIX: Only check constraints against history of THIS platform
                    const history = [...scheduledPosts]
                        .filter(p => p.platform === candidate.platform)
                        .reverse();

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
                    // Pass lastAssigned for diversity penalties
                    const score = scoreCandidate(candidatePost, {
                        primaryGoal: goal,
                        recentHistory: history,
                        lastPost: lastAssigned
                    });
                    return { ...candidate, score };
                });

                // 4. Select highest score
                scoredCandidates.sort((a, b) => b.score - a.score);
                const bestCandidate = scoredCandidates[0];

                // 5. Assign post to date with derivations
                const newPost: ScheduledPost = {
                    cohort: bestCandidate.cohort,
                    platform: bestCandidate.platform,
                    format: bestCandidate.format,
                    date: new Date(currentDate),
                    funnel: mapCohortToFunnel(bestCandidate.cohort),
                    boatPillar: mapCohortToBoatPillar(bestCandidate.cohort)
                };
                scheduledPosts.push(newPost);
                lastAssigned = newPost;

                // 6. Update remaining counts
                remainingRequirements.splice(bestCandidate.index, 1);

                // Set flag to try finding another post for a DIFFERENT platform today
                foundCandidateForDay = true;
            }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // ---------------------------------------------------------
    // FALLBACK PASS: Load Balancing (Fill gaps evenly)
    // ---------------------------------------------------------
    if (remainingRequirements.length > 0) {
        console.warn(`[Scheduler] Gap filling ${remainingRequirements.length} items using Load Balancing.`);

        // Create an array of all dates in the range
        const allDates: Date[] = [];
        let ptr = new Date(startDate);
        while (ptr <= endDate) {
            allDates.push(new Date(ptr));
            ptr.setDate(ptr.getDate() + 1);
        }

        // Process each remaining requirement
        for (let i = 0; i < remainingRequirements.length; i++) {
            const req = remainingRequirements[i];

            // Score all possible days for this requirement
            const candidateDays = allDates.map(day => {
                const dateStr = day.toISOString().split('T')[0];

                // Get constraints for this day
                const postsOnDay = scheduledPosts.filter(p => p.date.toISOString().split('T')[0] === dateStr);

                // 1. Platform Check: Already occupied?
                if (postsOnDay.some(p => p.platform === req.platform)) {
                    return null;
                }

                // 2. Hard Constraints Check (Backward looking only)
                // We check against posts *before* this date for this platform
                const postsBefore = scheduledPosts
                    .filter(p => p.platform === req.platform && p.date < day)
                    .sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first for validation

                const candidatePost: ScheduledPost = {
                    cohort: req.cohort,
                    platform: req.platform,
                    format: req.format,
                    date: day,
                    funnel: mapCohortToFunnel(req.cohort),
                    boatPillar: mapCohortToBoatPillar(req.cohort)
                };

                const constraintsPass = validateHardConstraints(candidatePost, postsBefore);

                return {
                    day,
                    load: postsOnDay.length, // How many posts already on this day?
                    constraintsPass
                };
            }).filter(d => d !== null);

            // Sort candidates:
            // 1. Constraints Pass (True first)
            // 2. Load (Ascending - pick lightest days)
            // 3. Random shuffle (to avoid stacking Monday if all equal)

            // Add a small random factor to sort to break ties
            candidateDays.sort((a, b) => {
                if (a!.constraintsPass !== b!.constraintsPass) {
                    return a!.constraintsPass ? -1 : 1; // Prefer passing constraints
                }
                if (a!.load !== b!.load) {
                    return a!.load - b!.load; // Prefer lower load
                }
                return Math.random() - 0.5;
            });

            // Pick the best day
            if (candidateDays.length > 0) {
                const best = candidateDays[0];

                // Assign
                const newPost: ScheduledPost = {
                    cohort: req.cohort,
                    platform: req.platform,
                    format: req.format,
                    date: best!.day,
                    funnel: mapCohortToFunnel(req.cohort),
                    boatPillar: mapCohortToBoatPillar(req.cohort),
                    coreMessage: "Filled (Balanced)",
                };
                scheduledPosts.push(newPost);
            } else {
                console.warn(`[Scheduler] Could not find any slot for ${req.platform} post. Dropping.`);
            }
        }
    }

    console.log(`[Scheduler] Total posts scheduled: ${scheduledPosts.length - initialHistory.length} across ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return scheduledPosts;
};
