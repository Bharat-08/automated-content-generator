import { type Platform, type PostFormat } from './formatDecider';
import { type CohortType } from './goalToCohort';
import { type PrimaryGoal } from './platformFrequency';
import { type ScheduledPost } from './hardConstraints';
import { mapCohortToBoatPillar } from './postDerivations';

export interface ScoringContext {
    primaryGoal: PrimaryGoal;
    recentHistory: ScheduledPost[];
    preferredDays?: number[]; // 0-6 (Sun-Sat)
    lastPost?: ScheduledPost; // Added for diversity
}

const FIT_SCORES: Record<CohortType, Record<Platform, number>> = {
    Educational: { LinkedIn: 15, YouTube: 12, Instagram: 6 },
    Product: { Instagram: 15, LinkedIn: 12, YouTube: 6 },
    Brand: { Instagram: 15, LinkedIn: 9, YouTube: 6 },
    Value: { Instagram: 15, YouTube: 12, LinkedIn: 6 },
};

/**
 * Calculates a soft score for a candidate post based on various optimization factors.
 */
export const scoreCandidate = (
    candidate: { cohort: CohortType; platform: Platform; format: PostFormat; date: Date },
    context: ScoringContext
): number => {
    let score = 0;

    // 1. Diversity Logic (New)
    if (context.lastPost) {
        // Harsh penalty for repeating the same cohort
        if (candidate.cohort === context.lastPost.cohort) {
            score -= 100;
        }

        // Moderate penalty for repeating the same pillar (e.g., Educational -> Brand both Background)
        const candidatePillar = mapCohortToBoatPillar(candidate.cohort);
        const lastPillar = context.lastPost.boatPillar || mapCohortToBoatPillar(context.lastPost.cohort);
        if (candidatePillar === lastPillar) {
            score -= 60;
        }

        // Penalty for repeating the same format
        if (candidate.format === context.lastPost.format) {
            score -= 80;
        }
    }

    // 2. Goal Alignment (+10 to +30)
    if (context.primaryGoal === 'thought-leadership' && candidate.cohort === 'Educational') score += 30;
    if ((context.primaryGoal === 'engagement' || context.primaryGoal === 'followers-growth') && (candidate.cohort === 'Value' || candidate.cohort === 'Brand')) score += 30;
    if ((context.primaryGoal === 'lead-gen' || context.primaryGoal === 'sales' || context.primaryGoal === 'traffic') && (candidate.cohort === 'Product' || candidate.cohort === 'Educational')) score += 30;

    // 2. Cohort Variety (+20)
    // Bonus if the cohort hasn't appeared in the last 3 posts
    const recentCohorts = context.recentHistory.slice(0, 3).map(p => p.cohort);
    if (!recentCohorts.includes(candidate.cohort)) {
        score += 20;
    }

    // 3. Platform Fit (+6 to +15)
    score += FIT_SCORES[candidate.cohort][candidate.platform] || 0;

    // 4. Day-of-Week Preference (+10)
    const day = candidate.date.getDay();
    const isWeekday = day >= 1 && day <= 5;

    if (candidate.cohort === 'Educational' && isWeekday) {
        score += 10;
    } else if ((candidate.cohort === 'Brand' || candidate.cohort === 'Value') && !isWeekday) {
        score += 10;
    }

    return score;
};
