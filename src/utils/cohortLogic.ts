import { type SocialPost, type ContentPillar } from '../data/mockPosts';

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
    community: number;
}

// Maps identifying semantic "Cohorts" to data "Pillars"
// Education -> Educational
// Promotional -> Product
// Personal -> Brand
// Inspiration -> Community
export const mapPillarToCohortType = (pillar: ContentPillar): keyof CohortMix => {
    switch (pillar) {
        case 'Educational': return 'educational';
        case 'Product': return 'product';
        case 'Brand': return 'brand';
        case 'Community': return 'community';
        default: return 'educational';
    }
};

export const getRecommendedMix = (goal: ContentGoal): CohortMix => {
    switch (goal) {
        case 'engagement':
            // High Community and Brand
            return { educational: 20, product: 10, brand: 40, community: 30 };
        case 'followers-growth':
            // High Community to reach new people
            return { educational: 25, product: 10, brand: 25, community: 40 };
        case 'traffic':
            // High Educational to provide value and link out
            return { educational: 50, product: 15, brand: 15, community: 20 };
        case 'lead-gen':
            // Balanced between Educational and Product
            return { educational: 40, product: 25, brand: 15, community: 20 };
        case 'sales':
            // Maximum allowed Product (25%) + Educational
            return { educational: 45, product: 25, brand: 10, community: 20 };
        case 'thought-leadership':
            // Very high Educational and strong Brand
            return { educational: 60, product: 5, brand: 10, community: 25 };
        default:
            return { educational: 25, product: 25, brand: 25, community: 25 };
    }
};

export const getCurrentMix = (posts: SocialPost[]): CohortMix => {
    const total = posts.length;
    if (total === 0) {
        return { educational: 0, product: 0, brand: 0, community: 0 };
    }

    const counts = posts.reduce((acc, post) => {
        const key = mapPillarToCohortType(post.pillar);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<keyof CohortMix, number>);

    return {
        educational: Math.round(((counts.educational || 0) / total) * 100),
        product: Math.round(((counts.product || 0) / total) * 100),
        brand: Math.round(((counts.brand || 0) / total) * 100),
        community: Math.round(((counts.community || 0) / total) * 100),
    };
};
