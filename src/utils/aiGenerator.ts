import { GoogleGenerativeAI } from "@google/generative-ai";
import { type SocialPost, type ContentPillar } from '../data/mockPosts';
import { type ContentGoal } from './cohortLogic';
import { type PerformanceSignals } from './performanceAnalyzer';
import { type CPCDimension, type BOATPillar, validateCPC, validateBOAT } from './gtmLogic';

export interface BrandProfile {
    name: string;
    category: string;
    audience: string;
    usp: string;
    timeframe?: { start: Date; end: Date };
    goals?: ContentGoal[];
    platforms?: string[];
    sensitivity?: string[];
    references?: string[];
}

export interface GeneratedContent {
    coreMessage: string;
    postCommunication: string;
    cpc: CPCDimension[];
    boat?: BOATPillar;
}

// Initialize Gemini Client
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? (process as any).env?.VITE_GEMINI_API_KEY : '') || '';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    tools: [{ googleSearch: {} } as any]
});

const GTM_SYSTEM_PROMPT = `
GTM-DRIVEN CONTENT LOGIC (FOR CALENDAR GENERATION)

1. OBJECTIVE
Generate a strategically structured social media post that:
• Aligns content to business objectives
• Balances Discovery vs Consideration intent
• Grounds the post in Category, Product, or Consumer insight (CPC)
• Prevents random or buzzword-driven content generation
• Uses Google Search Grounding to validate "Trends", "Market Norms", and "Competitor Moves"

4. CORE CONTENT LOGIC (NEW — GTM ENGINE)
4.1 CPC FRAMEWORK (FOUNDATIONAL CLASSIFICATION)
Every generated content idea must map to at least one CPC dimension:
- Category: Market norms, myths, trends (Verify via Search), reframes
- Product: Features, design, trials, usability, proof
- Consumer: Behaviours, anxieties, habits, motivations

4.2 BOAT FRAMEWORK (PRODUCT TRUTH LAYER)
All product-related content must be classified under one BOAT pillar:
- Background: Problem, science, need, category evolution
- Offerings: Features, design, comparisons
- Accessibility: Trials, purchase flow, usage
- Trust: Reviews, testimonials, confidence reduction

4.3 FUNNEL ASSIGNMENT (INTENT CONTROL)
- Discovery: Awareness, relatability, saves, shares (No selling, No urgency)
- Consideration: Education, de-risking, sign-ups (Product allowed, Proof allowed)

5. COHORT MIX MODEL
- Brand: Philosophy, POVs, reframes
- Educational: Science, explainers, how-it-works
- Product: Features, design, use cases
- Community: Stories, testimonials, empathy

6. FORMAT LOGIC
- Reel: Reach, emotion, relatability (Scene-by-scene flow)
- Carousel: Cognition, saves, learning (Slide-by-slide logic)
- Live: Trust, objections, depth (Structure & agenda)
- Static: Lightweight reinforcement

OUTPUT FORMAT (JSON ONLY):
{
  "coreMessage": "Single insight (not caption)",
  "postCommunication": "Detailed structure (Scene-by-scene for Reel, Slide-by-slide for Carousel, etc.)",
  "cpc": ["Category" | "Product" | "Consumer"],
  "boat": "Background" | "Offerings" | "Accessibility" | "Trust" (Optional, required if CPC includes Product)
}
`;

export const generateContentIdea = async (
    brand: BrandProfile,
    goal: ContentGoal,
    post: SocialPost,
    signals?: PerformanceSignals
): Promise<GeneratedContent> => { // Changed to async Promise
    try {
        const prompt = `
        CONTEXT:
        Brand: ${brand.name} (${brand.category})
        Audience: ${brand.audience}
        USP: ${brand.usp}
        Goals: ${brand.goals?.join(', ') || goal}
        Sensitivity: ${brand.sensitivity?.join(', ') || 'None'}
        References: ${brand.references?.join(', ') || 'None'}

        TASK:
        Generate a "${post.format}" post for "${post.platform}".
        Cohort: ${post.pillar} (mapped to GTM Cohort)
        Funnel Stage: ${post.funnel}
        
        ${signals?.insightSummary ? `PERFORMANCE INSIGHT: ${signals.insightSummary}` : ''}

        Ensure the content strictly follows the CPC and BOAT frameworks defined in the system prompt.
        Return ONLY valid JSON.
        `;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: GTM_SYSTEM_PROMPT + "\n" + prompt }] }
            ],
            generationConfig: { responseMimeType: "application/json" }
        });

        const text = result.response.text();
        const content = JSON.parse(text) as GeneratedContent;

        // Validation Rules
        if (!content.cpc || !Array.isArray(content.cpc) || !validateCPC(content.cpc)) {
            console.warn("Generated content CPC validation failed, falling back to Category.");
            content.cpc = ['Category'];
        }
        if (content.cpc.includes('Product') && !validateBOAT(content.cpc, content.boat)) {
            console.warn("Product content missing BOAT classification, defaulting to Offerings.");
            content.boat = 'Offerings';
        }

        // Normalize postCommunication to string if AI returned structured JSON
        if (typeof content.postCommunication !== 'string') {
            if (typeof content.postCommunication === 'object' && content.postCommunication !== null) {
                // If it looks like slides/scenes, try to make it readable
                const anyComm = content.postCommunication as any;
                if (Array.isArray(anyComm.slides)) {
                    content.postCommunication = anyComm.slides.map((s: any, i: number) => `Slide ${i + 1}: ${s.title || s.text || JSON.stringify(s)}`).join('\n');
                } else if (Array.isArray(anyComm.scenes)) {
                    content.postCommunication = anyComm.scenes.map((s: any, i: number) => `Scene ${i + 1}: ${s.description || s.script || JSON.stringify(s)}`).join('\n');
                } else {
                    content.postCommunication = JSON.stringify(content.postCommunication, null, 2);
                }
            } else {
                content.postCommunication = String(content.postCommunication);
            }
        }

        return content;

    } catch (error) {
        console.error("Gemini Content generation failed:", error);
        // Fallback for demo/offline resilience
        return {
            cpc: ['Category'],
            coreMessage: `(Fallback) ${brand.name} - ${post.pillar} Insight`,
            postCommunication: "System error: AI service unavailable.\nPlease check API key and connection."
        };
    }
};
