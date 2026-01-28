import { type SocialPost, type ContentPillar } from '../data/mockPosts';
import { type CohortMix, mapPillarToCohortType } from './cohortLogic';

interface RebalanceResult {
    rebalancedPosts: SocialPost[];
    changes: string[];
}

// Helper to reverse map Cohort Type to a pillar (deterministic choice)
// educational -> Educational
// product -> Product
// brand -> Brand
// community -> Community
const mapCohortTypeToPillar = (type: keyof CohortMix): ContentPillar => {
    switch (type) {
        case 'educational': return 'Educational';
        case 'product': return 'Product';
        case 'brand': return 'Brand';
        case 'community': return 'Community';
    }
};

export const rebalanceCalendar = (
    currentPosts: SocialPost[],
    targetMix: CohortMix
): RebalanceResult => {
    const posts = JSON.parse(JSON.stringify(currentPosts)) as SocialPost[]; // Deep copy
    const total = posts.length;
    if (total === 0) return { rebalancedPosts: posts, changes: [] };

    const changes: string[] = [];

    // 1. Calculate target counts
    const targetCounts: Record<keyof CohortMix, number> = {
        educational: Math.round(total * (targetMix.educational / 100)),
        product: Math.round(total * (targetMix.product / 100)),
        brand: Math.round(total * (targetMix.brand / 100)),
        community: Math.round(total * (targetMix.community / 100)),
    };

    // Adjust for rounding errors (simple fix: add to educational)
    const assignedTotal = Object.values(targetCounts).reduce((a, b) => a + b, 0);
    if (assignedTotal < total) {
        targetCounts.educational += (total - assignedTotal);
    }

    // 2. Identify current counts and buckets
    const buckets: Record<keyof CohortMix, SocialPost[]> = {
        educational: [],
        product: [],
        brand: [],
        community: []
    };

    posts.forEach(post => {
        const key = mapPillarToCohortType(post.pillar);
        buckets[key].push(post);
    });

    // 3. Rebalance
    // Logic: Take excess from over-represented buckets and move to under-represented ones.

    const categories = Object.keys(targetCounts) as (keyof CohortMix)[];

    // Create a pool of "excess" posts
    let excessPosts: SocialPost[] = [];

    // First pass: Harvest excess
    categories.forEach(cat => {
        const currentCount = buckets[cat].length;
        const targetCount = targetCounts[cat];

        if (currentCount > targetCount) {
            const diff = currentCount - targetCount;
            // Take 'diff' posts from the end of the bucket array (arbitrary deterministic choice)
            const removed = buckets[cat].splice(currentCount - diff, diff);
            excessPosts = [...excessPosts, ...removed];
            // Log generic change (will refine later)
        }
    });

    // Second pass: Distribute excess to deficit
    categories.forEach(cat => {
        const currentCount = buckets[cat].length;
        const targetCount = targetCounts[cat];

        if (currentCount < targetCount) {
            const needed = targetCount - currentCount;
            const toAdd = excessPosts.splice(0, needed);

            toAdd.forEach(post => {
                const oldPillar = post.pillar;
                const newPillar = mapCohortTypeToPillar(cat);
                post.pillar = newPillar;
                // Preserve original audience segment (legacy behavior removed)
                // post.cohort logic removed as no clear mapping exists and preservation is safer

                // Add to bucket
                buckets[cat].push(post);

                changes.push(`Changed post "${post.id}" from ${oldPillar} to ${newPillar}`);
            });
        }
    });

    // Flatten buckets back to array
    const rebalancedPosts = [
        ...buckets.educational,
        ...buckets.product,
        ...buckets.brand,
        ...buckets.community
    ].sort((a, b) => parseInt(a.id) - parseInt(b.id)); // Keep roughly original order if IDs are numeric

    return { rebalancedPosts, changes };
};
