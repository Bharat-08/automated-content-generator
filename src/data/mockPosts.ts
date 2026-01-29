import type { FunnelStage, ContentFormat } from '../utils/gtmLogic';
import type { Platform } from '../utils/platformFrequency';

export type { Platform };
export type AudienceSegment = 'Founders' | 'Creators' | 'Marketers'; // Renamed from Cohort to avoid confusion

// ContentPillar is now effectively CohortType in the new GTM logic
export type ContentPillar = 'Educational' | 'Product' | 'Brand' | 'Value';

export type { FunnelStage, ContentFormat };

export interface SocialPost {
    id: string;
    date: string;
    platform: Platform;
    funnel: FunnelStage;
    cohort: AudienceSegment; // Audience segment
    pillar: ContentPillar; // This is the "Cohort" in GTM logic (Educational, Product, etc.)
    format: ContentFormat;
    coreMessage: string;
    hook: string;
}

export const mockPosts: SocialPost[] = [
    {
        id: '1',
        date: '2026-02-01',
        platform: 'LinkedIn',
        funnel: 'Consideration',
        cohort: 'Founders',
        pillar: 'Educational',
        format: 'Carousel',
        coreMessage: 'Scaling to $1M requires systems, not just hustle.',
        hook: '3 mistakes preventing you from scaling to $1M (and how to fix them)',
    },
    {
        id: '2',
        date: '2026-02-02',
        platform: 'Instagram',
        funnel: 'Consideration',
        cohort: 'Creators',
        pillar: 'Brand',
        format: 'Reel',
        coreMessage: 'Behind the scenes of my content creation workflow.',
        hook: 'Stop guessing what to post. Here is my exact workflow 🎥',
    },
    {
        id: '3',
        date: '2026-02-03',
        platform: 'YouTube',
        funnel: 'Consideration',
        cohort: 'Marketers',
        pillar: 'Product',
        format: 'Static',
        coreMessage: 'Join the masterclass to learn advanced analytics.',
        hook: 'Marketing is math. If you want to master the numbers, join us this Friday.',
    },
    {
        id: '4',
        date: '2026-02-04',
        platform: 'LinkedIn',
        funnel: 'Discovery',
        cohort: 'Founders',
        pillar: 'Value',
        format: 'Static',
        coreMessage: 'Resilience is the most important trait for a founder.',
        hook: 'I wanted to quit 5 times last year. Here is why I didn\'t.',
    },
    {
        id: '5',
        date: '2026-02-05',
        platform: 'Instagram',
        funnel: 'Consideration',
        cohort: 'Creators',
        pillar: 'Educational',
        format: 'Carousel',
        coreMessage: 'How to design better thumbnails.',
        hook: 'Your content is good, but your packaging sucks. Fix it in 3 steps.',
    },
    {
        id: '6',
        date: '2026-02-06',
        platform: 'YouTube',
        funnel: 'Consideration',
        cohort: 'Founders',
        pillar: 'Educational',
        format: 'Static',
        coreMessage: 'The difference between sales and marketing.',
        hook: 'Sales captures value. Marketing creates it. Know the difference.',
    },
    {
        id: '7',
        date: '2026-02-07',
        platform: 'LinkedIn',
        funnel: 'Consideration',
        cohort: 'Marketers',
        pillar: 'Product',
        format: 'Static',
        coreMessage: 'Last chance to sign up for the cohort.',
        hook: 'Doors close in 24 hours. Don\'t miss out on Q1 planning.',
    },
    {
        id: '8',
        date: '2026-02-08',
        platform: 'Instagram',
        funnel: 'Discovery',
        cohort: 'Creators',
        pillar: 'Value',
        format: 'Reel',
        coreMessage: 'You are just one piece of content away.',
        hook: 'It took me 100 bad videos to make 1 good one. Keep going.',
    },
];
