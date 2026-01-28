export type CPCDimension = 'Category' | 'Product' | 'Consumer';

export type BOATPillar = 'Background' | 'Offerings' | 'Accessibility' | 'Trust';

export type FunnelStage = 'Discovery' | 'Consideration';

export type ContentFormat = 'Reel' | 'Carousel' | 'Live' | 'Static';

export interface GTMContent {
    cpc: CPCDimension[];
    boat?: BOATPillar; // Only for Product-related content
    funnel: FunnelStage;
    format: ContentFormat;
}

/**
 * CPC Validation Rules
 * Every generated content idea must map to at least one CPC dimension.
 */
export const validateCPC = (dimensions: CPCDimension[]): boolean => {
    return dimensions.length > 0;
};

/**
 * Funnel Rules
 * Discovery: No selling, no offers, no urgency CTAs.
 * Consideration: Product allowed, proof allowed, trials & testimonials encouraged.
 */
export const validateFunnelRules = (stage: FunnelStage, content: string): boolean => {
    const forbiddenDiscoveryTerms = ['buy now', 'sign up', 'offer', 'discount', 'limited time', 'sale'];
    
    if (stage === 'Discovery') {
        const lowerContent = content.toLowerCase();
        return !forbiddenDiscoveryTerms.some(term => lowerContent.includes(term));
    }
    
    return true;
};

/**
 * BOAT Framework Rules
 * All product-related content must be classified under one BOAT pillar.
 */
export const validateBOAT = (cpc: CPCDimension[], boat?: BOATPillar): boolean => {
    if (cpc.includes('Product')) {
        return !!boat;
    }
    return true; // Non-product content doesn't need BOAT
};
