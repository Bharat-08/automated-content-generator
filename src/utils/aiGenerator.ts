import { GoogleGenerativeAI } from "@google/generative-ai";
import { type SocialPost } from '../data/mockPosts';
import { type ContentGoal, type CohortMix } from './cohortLogic';
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
    model: "gemini-2.0-flash",
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
- Value: Stories, testimonials, empathy, value-driven insights

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

CRITICAL DISTRIBUTION RULE:
Distribute post types over the selected period to avoid clustering. 
- Do NOT generate the same "Cohort" or "Funnel Stage" back-to-back if possible.
- Ensure variety in "Format" (e.g., mix Reels, Carousels, Text).
- AVOID 4+ Sales/Product posts in a row.
`;

const STRATEGY_SYSTEM_PROMPT = `
STRATEGY MIX ENGINE
You are a Growth Marketing Strategist. Recommend a Content Mix distribution (percentages) based on brand information and performance data.

The distribution must be across 4 cohorts:
1. educational: Science, guides, how-to, education.
2. product: Features, benefits, trials, purchase flow.
3. value: Reviews, testimonials, shared values, user stories.
4. brand: Philosophy, point of view, industry reframes, USP focus.

RULES:
- Total must equal EXACTLY 100.
- Return ONLY valid JSON.
- If Performance Signals are provided, lean into the cohorts that show higher engagement or conversion.
- Defaults if unsure: 25% each, or lean Brand/Education for early stage.

OUTPUT FORMAT (JSON ONLY):
{
  "educational": number,
  "product": number,
  "community": number,
  "brand": number
}
`;

export interface StrategySuggestion extends CohortMix {
    reasoning?: string;
}

export const generateContentIdea = async (
    brand: BrandProfile,
    goal: ContentGoal,
    post: SocialPost,
    signals?: PerformanceSignals,
    instruction?: string
): Promise<GeneratedContent> => {
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
        ${instruction ? `USER INSTRUCTION: ${instruction}` : ''}

        Ensure the content strictly follows the CPC and BOAT frameworks defined in the system prompt.
        Return ONLY valid JSON.
        `;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: GTM_SYSTEM_PROMPT + "\n" + prompt }] }
            ]
        });

        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : text;

        let content: GeneratedContent;
        try {
            content = JSON.parse(jsonString) as GeneratedContent;
        } catch (e) {
            console.warn("Retrying JSON extraction from markdown...");
            const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
            content = JSON.parse(cleaned) as GeneratedContent;
        }

        if (!content.cpc || !Array.isArray(content.cpc) || !validateCPC(content.cpc)) {
            console.warn("Generated content CPC validation failed, falling back to Category.");
            content.cpc = ['Category'];
        }
        if (content.cpc.includes('Product') && !validateBOAT(content.cpc, content.boat)) {
            console.warn("Product content missing BOAT classification, defaulting to Offerings.");
            content.boat = 'Offerings';
        }

        if (typeof content.postCommunication !== 'string') {
            if (typeof content.postCommunication === 'object' && content.postCommunication !== null) {
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
        return {
            cpc: ['Category'],
            coreMessage: `(Fallback) ${brand.name} - ${post.pillar} Insight`,
            postCommunication: "System error: AI service unavailable.\nPlease check API key and connection."
        } as GeneratedContent;
    }
};

export const suggestStrategyMix = async (
    brand: BrandProfile,
    signals?: PerformanceSignals
): Promise<StrategySuggestion> => {
    try {
        const prompt = `
        CONTEXT:
        Brand: ${brand.name} (${brand.category})
        Audience: ${brand.audience}
        USP: ${brand.usp}
        Goals: ${brand.goals?.join(', ') || 'General growth'}
        
        ${signals?.insightSummary ? `PERFORMANCE DATA: ${signals.insightSummary}` : ''}

        TASK:
        Recommend the optimal percentage distribution for the 4 content cohorts.
        Ensure they sum to 100.
        `;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: STRATEGY_SYSTEM_PROMPT + "\n" + prompt }] }
            ]
        });

        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : text;

        const suggestion = JSON.parse(jsonString) as StrategySuggestion;

        const total = (suggestion.educational || 0) + (suggestion.product || 0) + (suggestion.value || 0) + (suggestion.brand || 0);
        if (total !== 100 && total > 0) {
            const ratio = 100 / total;
            suggestion.educational = Math.round((suggestion.educational || 0) * ratio);
            suggestion.product = Math.round((suggestion.product || 0) * ratio);
            suggestion.value = Math.round((suggestion.value || 0) * ratio);
            suggestion.brand = 100 - (suggestion.educational + suggestion.product + suggestion.value);
        }

        return suggestion;
    } catch (error) {
        console.error("Gemini Strategy suggestion failed:", error);
        return {
            educational: 25,
            product: 25,
            value: 25,
            brand: 25,
            reasoning: "Fallback to default distribution due to error."
        };
    }
};
