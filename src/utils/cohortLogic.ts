import { type ContentPillar } from '../data/mockPosts';

export type ContentGoal =
    | 'engagement'
    | 'followers-growth'
    | 'traffic'
    | 'lead-gen'
    | 'sales'
    | 'thought-leadership';

export interface CohortMix {
    educational: number;
    product: number;
    brand: number;
    value: number;
}

// Maps identifying semantic "Cohorts" to data "Pillars"
// Education -> Educational
// Promotional -> Product
// Personal -> Brand
// Inspiration -> Value
export const mapPillarToCohortType = (pillar: ContentPillar): keyof CohortMix => {
    switch (pillar) {
        case 'Educational': return 'educational';
        case 'Product': return 'product';
        case 'Brand': return 'brand';
        case 'Value': return 'value';
        default: return 'educational';
    }
};

// getRecommendedMix can be kept if we ever want to expose "optimal" mix as a reference,
// but for now it's redundant with goalToCohort.ts logic.
// However, calculateSmartMix was using it.
// Since we are moving to a fully internal model, we'll keep only what's necessary.
