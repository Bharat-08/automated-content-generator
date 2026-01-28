import { type ScheduledPost } from './hardConstraints';
import { type PrimaryGoal } from './platformFrequency';
import { type UnscheduledRequirement, scheduleCalendar } from './scheduleCalendar';

/**
 * Rebalances the schedule from a specific cutoff date.
 * Posts before the cutoff are preserved. Posts after are regenerated.
 * 
 * @param currentCalendar - The existing schedule.
 * @param cutoffDate - The date from which to start rebalancing.
 * @param newGoal - The updated business goal.
 * @param newRequirements - The updated set of requirements for the remaining period.
 * @returns An updated ScheduledPost array.
 */
export const triggerRebalance = (
    currentCalendar: ScheduledPost[],
    cutoffDate: Date,
    newGoal: PrimaryGoal,
    newRequirements: UnscheduledRequirement[]
): ScheduledPost[] => {
    // 1. Split into preserved and to-be-replaced
    const preservedPosts = currentCalendar.filter(post => post.date < cutoffDate);

    // 2. Identify the end date from the original calendar
    const lastPost = currentCalendar[currentCalendar.length - 1];
    const endDate = lastPost ? lastPost.date : cutoffDate;

    // 3. Re-run scheduling starting from the cutoff
    const updatedFuture = scheduleCalendar(
        cutoffDate,
        endDate,
        newRequirements,
        newGoal,
        preservedPosts
    );

    // 4. Merge (excluding the historical filler from updatedFuture if scheduleCalendar returns everything)
    // Actually, scheduleCalendar with initialHistory should only return the NEW posts it added.
    // Wait, looking at my scheduleCalendar implementation... 
    // It returns scheduledPosts which starts with initialHistory. 
    // Let's refine scheduleCalendar to return ONLY the newly scheduled posts if initialHistory is provided?
    // No, let's keep it returning the full state, or filter here.

    return updatedFuture;
};
