import { type CohortType } from './goalToCohort';
import { type FunnelStage, type BOATPillar } from './gtmLogic';

export type { FunnelStage, BOATPillar };

/**
 * Maps a cohort type to a funnel stage in a deterministic way.
 */
export const mapCohortToFunnel = (cohort: CohortType): FunnelStage => {
    switch (cohort) {
        case 'Educational':
            return 'Consideration';
        case 'Product':
            return 'Consideration';
        case 'Brand':
            return 'Discovery';
        case 'Community':
            return 'Discovery';
        default:
            return 'Discovery';
    }
};

/**
 * Maps a cohort type to a BOAT pillar in a deterministic way.
 * Note: Not all cohorts strictly require a BOAT pillar, but we map for completeness.
 */
export const mapCohortToBoatPillar = (cohort: CohortType): BOATPillar => {
    switch (cohort) {
        case 'Educational':
            return 'Background';
        case 'Product':
            return 'Offerings';
        case 'Brand':
            return 'Background'; // Brand philosophy often aligns with Background/Category evolution
        case 'Community':
            return 'Trust';
        default:
            return 'Trust';
    }
};
