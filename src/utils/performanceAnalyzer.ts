export interface PerformanceSignals {
    topPlatforms: string[];
    winningFormats: string[];
    topPillars: string[];
    topFunnels: string[];
    topCohorts: string[];
    platformWeights: Record<string, number>; // Normalized 0-2 scale, 1 = neutral
    insightSummary: string;
    avgEngagement?: number;
}

export const analyzePerformance = (data: Record<string, string>[]): PerformanceSignals => {
    if (data.length === 0) {
        return {
            topPlatforms: [],
            winningFormats: [],
            topPillars: [],
            topFunnels: [],
            topCohorts: [],
            platformWeights: {},
            insightSummary: "No historical data available."
        };
    }

    // Simple frequency/score counters (case-insensitive)
    const platformScores: Record<string, number> = {};
    const formatScores: Record<string, number> = {};
    const pillarScores: Record<string, number> = {};
    const funnelScores: Record<string, number> = {};
    const cohortScores: Record<string, number> = {};

    let totalEngagement = 0;

    data.forEach(row => {
        // Normalize keys and check for variations
        const getKey = (...keys: string[]) => {
            for (const k of keys) {
                if (row[k] || row[k.toLowerCase()]) return (row[k] || row[k.toLowerCase()] || '').trim().toLowerCase();
            }
            return '';
        };

        const platform = getKey('Platform', 'Channel');
        const format = getKey('Format', 'Type', 'MediaType');
        const pillar = getKey('Pillar', 'Category', 'Topic', 'BOAT Pillar');
        const funnel = getKey('Funnel', 'Stage', 'Funnel Stage');
        const cohort = getKey('Cohort', 'Audience', 'Segment');

        // Engagement weight
        const engagement =
            parseInt(row['Engagement'] || row['engagement'] || '0') ||
            (parseInt(row['Likes'] || row['likes'] || '0') + parseInt(row['Comments'] || row['comments'] || '0')) ||
            1;

        totalEngagement += engagement;

        if (platform) platformScores[platform] = (platformScores[platform] || 0) + engagement;
        if (format) formatScores[format] = (formatScores[format] || 0) + engagement;
        if (pillar) pillarScores[pillar] = (pillarScores[pillar] || 0) + engagement;
        if (funnel) funnelScores[funnel] = (funnelScores[funnel] || 0) + engagement;
        if (cohort) cohortScores[cohort] = (cohortScores[cohort] || 0) + engagement;
    });

    const getTop = (scores: Record<string, number>, limit = 3) =>
        Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));

    const topPlatforms = getTop(platformScores);
    const winningFormats = getTop(formatScores);
    const topPillars = getTop(pillarScores);
    const topFunnels = getTop(funnelScores);
    const topCohorts = getTop(cohortScores);

    // Calculate Platform Weights (Normalized around 1.0)
    // Avg score per platform compared to overall avg?
    // Or just boost top platforms?
    // Let's do: score / average_score_across_platforms
    const platforms = Object.keys(platformScores);
    const platformWeights: Record<string, number> = {};

    if (platforms.length > 0) {
        const avgScore = Object.values(platformScores).reduce((a, b) => a + b, 0) / platforms.length;
        platforms.forEach(p => {
            const raw = platformScores[p];
            // Weight: 0.5 to 1.5 range?
            // If raw == avg, weight = 1.
            // If raw > avg, weight > 1.
            // Cap at 1.5 for safety.
            const ratio = raw / (avgScore || 1);
            // Dampen the ratio: 1 + (ratio - 1) * 0.5
            const weight = 1 + (ratio - 1) * 0.5;
            platformWeights[p.charAt(0).toUpperCase() + p.slice(1)] = Math.max(0.5, Math.min(1.5, weight));
        });
    }

    const insightSummary = `Analysis based on ${data.length} rows: High engagement detected on ${topPlatforms.join(' & ')} using ${winningFormats.join('/')}. Recommended focus: ${topFunnels[0] || 'General'} funnel targeting ${topCohorts[0] || 'Core'} cohort.`;

    return {
        topPlatforms,
        winningFormats,
        topPillars,
        topFunnels,
        topCohorts,
        platformWeights,
        insightSummary,
        avgEngagement: totalEngagement / data.length
    };
};
