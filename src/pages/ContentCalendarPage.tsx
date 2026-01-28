import { useState, useMemo, useEffect, useRef } from 'react';
import CalendarGrid from '../components/CalendarGrid';
import ListView from '../components/ListView';
import { mockPosts, type SocialPost } from '../data/mockPosts';
import { generateDateSlots } from '../utils/dateSlotGenerator';
import { mapCohortToFunnel } from '../utils/postDerivations';
import { type ContentGoal, getRecommendedMix, type CohortMix } from '../utils/cohortLogic';
import { rebalanceCalendar } from '../utils/rebalanceCalendar';
import { type BrandProfile, generateContentIdea, suggestStrategyMix } from '../utils/aiGenerator';
import { parseCSV } from '../utils/csvParser';
import { normalizeCalendar } from '../utils/normalizePost';
import { type PrimaryGoal } from '../utils/platformFrequency';
import { calculateGoalToCohort, type CohortType, GOAL_COHORT_DISTRIBUTION } from '../utils/goalToCohort';
import { decidePostFormat } from '../utils/formatDecider';
import { analyzePerformance, type PerformanceSignals } from '../utils/performanceAnalyzer';
import { exportContent } from '../utils/exportCsv';

// Simple CSS Spinner component to avoid external assets
const Spinner = ({ size = 16, color = 'white' }) => (
    <div style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid ${color}`,
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        display: 'inline-block'
    }}>
        <style>{`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
    </div>
);

export type Timeframe = '2-weeks' | '1-month' | '3-months';

interface StrategyConfig {
    brand: BrandProfile;
    goal: ContentGoal;
    timeframe: Timeframe;
    planningMonth: string; // YYYY-MM
    performanceSignals: PerformanceSignals | null;
    uploadStatus: { filename: string; count: number } | null;
    customMix?: Record<CohortType, number>; // Added for manual rebalancing
}

const INITIAL_CONFIG: StrategyConfig = {
    brand: {
        name: 'Growth Agency',
        category: 'Social Media Marketing',
        audience: 'Startup Founders',
        usp: 'Content that converts to cash',
        platforms: ['LinkedIn', 'Instagram'],
        goals: ['engagement', 'thought-leadership'],
        sensitivity: [],
        references: []
    },
    goal: 'engagement',
    timeframe: '1-month',
    planningMonth: '2026-02',
    performanceSignals: null,
    uploadStatus: null
    // customMix defaults to undefined
};

const ContentCalendarPage = () => {
    const [posts, setPosts] = useState(mockPosts);
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [, setLastChanges] = useState<string[]>([]);

    // Staged Configuration
    const [draftConfig, setDraftConfig] = useState<StrategyConfig>(INITIAL_CONFIG);
    const [activeConfig, setActiveConfig] = useState<StrategyConfig>(INITIAL_CONFIG);

    // Goal mapping helper
    const mapToPrimaryGoal = (goal: ContentGoal): PrimaryGoal => {
        if (goal === 'engagement' || goal === 'followers-growth') return 'Engagement/Awareness';
        if (goal === 'thought-leadership') return 'Thought Leadership';
        return 'Leads/Sales';
    };

    const syncCalendarToConfig = (config: StrategyConfig, currentPosts: SocialPost[]) => {
        const primaryGoal = mapToPrimaryGoal(config.goal);

        // 1. Generate Deterministic Slots
        const slots = generateDateSlots({
            planningMonth: config.planningMonth,
            timeframe: config.timeframe,
            primaryGoal,
            activePlatforms: config.brand.platforms as any || [],
            performanceSignals: config.performanceSignals || undefined
        });

        // Calculate the effective date range for this generation to know what to replace
        const [year, month] = config.planningMonth.split('-').map(Number);
        const start = new Date(year, month - 1, 1, 12, 0, 0);
        const end = new Date(start);

        if (config.timeframe === '2-weeks') {
            end.setDate(start.getDate() + 13); // 14 days total
        } else if (config.timeframe === '1-month') {
            end.setMonth(start.getMonth() + 1);
            end.setDate(0);
        } else {
            end.setMonth(start.getMonth() + 3);
            end.setDate(0);
        }
        // Set end to end of day for inclusive comparison
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0); // Start of day

        // 2. Calculate Cohort Distribution
        const totalPostCount = slots.length;
        const timeframeWeeks = config.timeframe === '2-weeks' ? 2 : config.timeframe === '1-month' ? 4 : 12;

        const cohortCounts = calculateGoalToCohort({
            primaryGoal,
            timeframeWeeks,
            totalPostCount,
            customMix: config.customMix // Pass custom mix
        });

        // 3. Create pool
        const cohortPool: CohortType[] = [];
        Object.entries(cohortCounts).forEach(([cohort, count]) => {
            for (let i = 0; i < count; i++) cohortPool.push(cohort as CohortType);
        });

        // 4. Assign Cohorts & Formats
        const newRangePosts: SocialPost[] = slots.map((slot, idx) => {
            const cohort = cohortPool[idx % cohortPool.length];
            const format = decidePostFormat(slot.platform, cohort, primaryGoal, config.performanceSignals || undefined);
            const dateStr = slot.date.toISOString().split('T')[0];

            // Check for existing manual content to preserve WITHIN this new range
            const existing = currentPosts.find(old =>
                old.date === dateStr &&
                old.platform === slot.platform
            );

            return {
                id: existing?.id || `new-${dateStr}-${slot.platform}-${idx}`,
                date: dateStr,
                platform: slot.platform as any,
                funnel: mapCohortToFunnel(cohort),
                cohort: 'Founders',
                pillar: cohort as any,
                format: format as any,
                coreMessage: existing?.coreMessage || '',
                hook: existing?.hook || ''
            };
        });

        // 5. MERGE: Keep posts outside the generated range, replace those inside
        const preservedPosts = currentPosts.filter(p => {
            const pDate = new Date(p.date + 'T12:00:00');
            return pDate < start || pDate > end;
        });

        // Combine and sort
        return [...preservedPosts, ...newRangePosts].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    };

    // New: Regenerate specific week
    const handleRegenerateWeek = (start: Date, end: Date) => {
        const config = activeConfig; // Use valid config
        const primaryGoal = mapToPrimaryGoal(config.goal);

        // 1. Generate ALL slots (to ensure we get the right ones for this timeframe logic)
        const allSlots = generateDateSlots({
            planningMonth: config.planningMonth,
            timeframe: config.timeframe,
            primaryGoal,
            activePlatforms: config.brand.platforms as any || [],
            performanceSignals: config.performanceSignals || undefined
        });

        // 2. Filter for slots in range
        const weekSlots = allSlots.filter(s => s.date >= start && s.date <= end);

        if (weekSlots.length === 0) return;

        // 3. Calculate Cohort Distribution for this specific batch
        const totalPostCount = weekSlots.length;
        // For a single week, we treat it as 1 week timeframe
        const cohortCounts = calculateGoalToCohort({
            primaryGoal,
            timeframeWeeks: 1,
            totalPostCount,
            customMix: config.customMix
        });

        // 4. Create pool
        const cohortPool: CohortType[] = [];
        Object.entries(cohortCounts).forEach(([cohort, count]) => {
            for (let i = 0; i < count; i++) cohortPool.push(cohort as CohortType);
        });

        // 5. Assign
        const newWeekPosts: SocialPost[] = weekSlots.map((slot, idx) => {
            const cohort = cohortPool[idx % cohortPool.length];
            const format = decidePostFormat(slot.platform, cohort, primaryGoal, config.performanceSignals || undefined);
            const dateStr = slot.date.toISOString().split('T')[0];

            return {
                id: `regen-${dateStr}-${slot.platform}-${Date.now()}-${idx}`, // Force new ID
                date: dateStr,
                platform: slot.platform as any,
                funnel: mapCohortToFunnel(cohort),
                cohort: 'Founders', // Static context
                pillar: cohort as any,
                format: format as any,
                coreMessage: '', // AI will fill
                hook: ''
            };
        });

        // 6. Merge: Keep posts outside range, add new ones
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        setPosts(prev => {
            // Need to be careful with string comparison if timestamps differ, but dateStr is YYYY-MM-DD
            const outside = prev.filter(p => p.date < startStr || p.date > endStr);
            return [...outside, ...newWeekPosts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        setLastChanges([`Regenerated content for week of ${startStr}`]);
    };

    // Initialize on mount
    useEffect(() => {
        // Initial load: don't pass mockPosts if we want to simulate empty start, 
        // but for dev we load mockPosts. 
        // We sync mockPosts to ensure they align with default config but respecting preservation??
        // actually for init we probably just want to setPosts(mockPosts) or run a sync.
        // Current logic: syncCalendarToConfig(INITIAL_CONFIG, mockPosts). 
        // This will now preserve specific mock posts outside feb?
        // Mock posts dates need to be checked.
        const initial = syncCalendarToConfig(INITIAL_CONFIG, mockPosts);
        setPosts(initial);
    }, []);

    // dirty check
    const isDirty = useMemo(() => {
        return JSON.stringify(draftConfig) !== JSON.stringify(activeConfig);
    }, [draftConfig, activeConfig]);

    // UI States
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [isAiStrategyOn, setIsAiStrategyOn] = useState(true);
    const [isSuggesting, setIsSuggesting] = useState(false);

    // Auto-suggest strategy when goals or signals change
    useEffect(() => {
        if (!isAiStrategyOn) return;

        const suggest = async () => {
            setIsSuggesting(true);
            try {
                const suggestion = await suggestStrategyMix(draftConfig.brand, draftConfig.performanceSignals || undefined);
                setDraftConfig(prev => ({
                    ...prev,
                    customMix: {
                        Educational: suggestion.educational,
                        Product: suggestion.product,
                        Brand: suggestion.brand,
                        Community: suggestion.community
                    }
                }));
            } catch (err) {
                console.error("Auto-strategy suggestion failed", err);
            } finally {
                setIsSuggesting(false);
            }
        };

        const timeout = setTimeout(suggest, 1000); // Debounce
        return () => clearTimeout(timeout);
    }, [draftConfig.brand.goals, draftConfig.brand.usp, draftConfig.brand.audience, draftConfig.performanceSignals, isAiStrategyOn]);

    // Basic Validation
    const validationErrors = useMemo(() => {
        const errors: string[] = [];
        if (!draftConfig.brand.name.trim()) errors.push("Brand Name is required.");
        if (!draftConfig.goal) errors.push("Strategic Goal is required.");
        return errors;
    }, [draftConfig.brand.name, draftConfig.goal]);

    const isValid = validationErrors.length === 0;

    const filteredPosts = useMemo(() => {
        const [year, month] = activeConfig.planningMonth.split('-').map(Number);
        // Use Noon to avoid timezone shifts
        const start = new Date(year, month - 1, 1, 12, 0, 0);
        const end = new Date(start);

        if (activeConfig.timeframe === '2-weeks') {
            end.setDate(start.getDate() + 14);
        } else if (activeConfig.timeframe === '1-month') {
            // go to next month, day 0 = last day of current month
            end.setMonth(start.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59); // Include the entire last day
        } else {
            // 3 months
            end.setMonth(start.getMonth() + 3);
            end.setDate(0);
            end.setHours(23, 59, 59);
        }

        const validPosts: SocialPost[] = [];
        const ignoredPosts: SocialPost[] = [];

        posts.forEach(post => {
            const postDate = new Date(post.date + 'T12:00:00'); // Parse with noon to match
            if (postDate >= start && postDate <= end) {
                validPosts.push(post);
            } else {
                ignoredPosts.push(post);
            }
        });

        if (import.meta.env.DEV && ignoredPosts.length > 0) {
            // console.warn(`[ContentCalendar] ⚠️ Excluded ${ignoredPosts.length} posts outside planning window (${activeConfig.planningMonth}).`, ignoredPosts);
        }

        return validPosts.sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.platform.localeCompare(b.platform);
        });
    }, [posts, activeConfig.timeframe, activeConfig.planningMonth]);


    const recommendedMix = useMemo(() => getRecommendedMix(activeConfig.goal), [activeConfig.goal]);

    const normalizedPosts = useMemo(() => {
        // Map SocialPost (current state) to ScheduledPost-like structure for normalization
        const scheduledLike = filteredPosts.map(p => ({
            cohort: p.pillar, // In mock data pillar is what we call cohort in automation
            platform: p.platform as any,
            format: p.format as any,
            date: new Date(p.date),
            coreMessage: p.coreMessage,
            postCommunication: p.hook // In existing state, 'hook' holds the postCommunication text
        }));

        return normalizeCalendar(scheduledLike, activeConfig.brand, activeConfig.goal as any);
    }, [filteredPosts, activeConfig.brand, activeConfig.goal]);

    const handleApplyChanges = () => {
        setActiveConfig(draftConfig);
        const synced = syncCalendarToConfig(draftConfig, posts);
        setPosts(synced);
        setLastChanges(['Strategy applied successfully. Full schedule generated.']);
        setTimeout(() => setLastChanges([]), 5000);
    };

    const handleRebalance = () => {
        const { rebalancedPosts, changes } = rebalanceCalendar(posts, recommendedMix);
        setPosts(rebalancedPosts);
        setLastChanges(changes);
        setTimeout(() => setLastChanges([]), 5000);
    };

    const handleRegeneratePost = async (postId: string) => {
        setError(null);

        // Find the post in latest state to ensure we have current metadata
        const targetPost = posts.find(p => p.id === postId);
        if (!targetPost) return;

        setGeneratingPostIds(prev => new Set(prev).add(postId));

        try {
            // Small delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 600));

            // Use the primary goal from config, but AI will see all brand.goals
            const idea = await generateContentIdea(activeConfig.brand, activeConfig.goal as any, targetPost, activeConfig.performanceSignals || undefined);

            if (idea.coreMessage === "Post idea unavailable") {
                throw new Error("AI failed to generate a valid idea.");
            }

            // Update only the specific post
            setPosts((prevPosts: SocialPost[]) => prevPosts.map((p: SocialPost) =>
                p.id === postId
                    ? { ...p, coreMessage: idea.coreMessage, hook: idea.postCommunication }
                    : p
            ));
        } catch (err: any) {
            setError(err.message || "Failed to regenerate post.");
        } finally {
            setGeneratingPostIds(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
        }
    };

    const stopGenerationRef = useRef(false);

    const handleStopGeneration = () => {
        stopGenerationRef.current = true;
        setLastChanges(['Generation stopped by user.']);
    };

    const handleGenerateAll = async () => {
        setError(null);
        setIsGeneratingAll(true);
        stopGenerationRef.current = false; // Reset stop flag
        let successCount = 0;
        let failCount = 0;

        try {
            // 1. Force Strategy Application logic first
            // Always regenerate the schedule based on DRAFT config to ensure clean slate
            setActiveConfig(draftConfig);

            // Pass 'posts' to preserve prior history outside this month
            const newPosts = syncCalendarToConfig(draftConfig, posts);
            setPosts(newPosts); // Optimistic UI update

            // 2. Generate content for these NEW posts ONLY
            // We need to identify which posts are actually "new" or "in scope". 
            // We can filter newPosts by the planning range again, but easier to just check IDs or flag them.
            // But strict requirement: "Generated posts must be scoped ONLY to selected month".
            // So we only AI-generate for the posts falling in the planning month.

            const [year, month] = draftConfig.planningMonth.split('-').map(Number);
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);

            const postsToGenerate = newPosts.filter(p => {
                const d = new Date(p.date);
                // Only generate if empty? Or regenerate all?
                // "Generate Content" usually implies generating fresh ideas for the structure.
                // We will generate for all posts in the current window.
                return d >= start && d <= end;
            });

            const postIds = postsToGenerate.map(p => p.id);

            for (const postId of postIds) {
                // Check for stop signal
                if (stopGenerationRef.current) {
                    break;
                }

                // We use 'newPosts' here because state 'posts' might not be updated inside this closure yet
                const currentPost = newPosts.find(p => p.id === postId);
                if (!currentPost) continue;

                setGeneratingPostIds(prev => new Set(prev).add(postId));

                try {
                    await new Promise(resolve => setTimeout(resolve, 150));

                    const idea = await generateContentIdea(draftConfig.brand, draftConfig.goal as any, currentPost, draftConfig.performanceSignals || undefined);

                    if (idea.coreMessage === "Post idea unavailable") {
                        throw new Error("AI failed");
                    }

                    setPosts((prevPosts: SocialPost[]) => prevPosts.map((p: SocialPost) =>
                        p.id === postId
                            ? { ...p, coreMessage: idea.coreMessage, hook: idea.postCommunication }
                            : p
                    ));
                    successCount++;
                } catch (err) {
                    failCount++;
                } finally {
                    setGeneratingPostIds(prev => {
                        const next = new Set(prev);
                        next.delete(postId);
                        return next;
                    });
                }
            }

            if (stopGenerationRef.current) {
                // toast/notify already handled by stop handler
            } else if (failCount > 0) {
                setLastChanges([`Bulk generation complete: ${successCount} updated, ${failCount} skipped.`]);
            } else {
                setLastChanges([`Clean calendar generated with ${successCount} fresh ideas.`]);
            }
            setTimeout(() => setLastChanges([]), 5000);
        } catch (err) {
            setError("Bulk generation encountered a critical error.");
        } finally {
            setIsGeneratingAll(false);
            stopGenerationRef.current = false;
        }
    };

    const handleExport = async (format: 'csv' | 'xlsx') => {
        if (normalizedPosts.length === 0 || isExporting) return;

        setIsExporting(true);
        setShowExportMenu(false); // Close menu
        try {
            // Subtle UI delay for feedback
            await new Promise(resolve => setTimeout(resolve, 800));
            const [year, month] = activeConfig.planningMonth.split('-');
            const filename = `content-calendar-${month}-${year}`; // Extension added by util
            exportContent(normalizedPosts, format, filename);
        } finally {
            setIsExporting(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            setError("Please upload a valid CSV file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            try {
                const data = parseCSV(text);
                if (data.length === 0) throw new Error("File is empty or malformed.");

                const signals = analyzePerformance(data);

                setDraftConfig(prev => ({
                    ...prev,
                    performanceSignals: signals,
                    uploadStatus: { filename: file.name, count: data.length }
                }));
                setError(null);
            } catch (err: any) {
                setError(`Failed to parse CSV: ${err.message}`);
            }
        };
        reader.readAsText(file);
    };


    const getColor = (key: keyof CohortMix) => {
        switch (key) {
            case 'educational': return '#3b82f6';
            case 'product': return '#10b981';
            case 'community': return '#f59e0b';
            case 'brand': return '#8b5cf6';
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#09090b',
            color: '#e4e4e7',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            paddingBottom: '80px',
            overflowX: 'hidden'
        }}>
            {/* Global Header */}
            <header style={{
                borderBottom: '1px solid #27272a',
                padding: '24px 0',
                backgroundColor: 'rgba(9, 9, 11, 0.8)',
                backdropFilter: 'blur(12px)',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0, color: '#fafafa' }}>Content<span style={{ color: '#4f46e5' }}>AI</span></h1>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: (isDirty || !isValid) ? '#f59e0b' : '#10b981', fontWeight: '600', transition: 'color 0.3s' }}>
                            {isDirty ? '● Unsaved Changes' : '● System Ready'}
                        </div>
                        <button
                            onClick={handleApplyChanges}
                            disabled={!isDirty || !isValid}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: (isDirty && isValid) ? '#fff' : '#27272a',
                                color: (isDirty && isValid) ? '#000' : '#71717a',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: (isDirty && isValid) ? 'pointer' : 'not-allowed',
                                fontWeight: '600',
                                fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                        >
                            Apply Strategy
                        </button>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '48px' }}>

                {/* 1. Strategy Configuration Section */}
                <section>
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>Strategy Dashboard</h2>
                        <p style={{ color: '#a1a1aa', fontSize: '15px', marginTop: '6px' }}>Configure your brands goals and targeting parameters.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                        {/* Core Identify */}
                        <div style={{ backgroundColor: '#18181b', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>Identity</h3>
                            </div>

                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Brand Name</label>
                                    <input
                                        value={draftConfig.brand.name}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, name: e.target.value } }))}
                                        placeholder="Name"
                                        style={{ padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: '1px solid transparent', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'box-shadow 0.2s' }}
                                        onFocus={e => e.target.style.boxShadow = '0 0 0 2px #4f46e5'}
                                        onBlur={e => e.target.style.boxShadow = 'none'}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Category</label>
                                    <input
                                        value={draftConfig.brand.category}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, category: e.target.value } }))}
                                        placeholder="Industry"
                                        style={{ padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: '1px solid transparent', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Objectives */}
                        <div style={{ backgroundColor: '#18181b', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>Strategy & Channels</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Platforms */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a', display: 'block', marginBottom: '8px' }}>Active Platforms</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {['LinkedIn', 'Instagram', 'Twitter', 'YouTube'].map(p => (
                                            <label key={p} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '6px 12px', backgroundColor: '#27272a', borderRadius: '6px',
                                                fontSize: '13px', cursor: 'pointer',
                                                border: draftConfig.brand.platforms?.includes(p) ? '1px solid #10b981' : '1px solid transparent'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={draftConfig.brand.platforms?.includes(p)}
                                                    onChange={e => {
                                                        const current = draftConfig.brand.platforms || [];
                                                        const next = e.target.checked
                                                            ? [...current, p]
                                                            : current.filter(x => x !== p);
                                                        setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, platforms: next } }));
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                <span style={{ color: draftConfig.brand.platforms?.includes(p) ? '#10b981' : '#a1a1aa' }}>●</span>
                                                {p}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Goals */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a', display: 'block', marginBottom: '8px' }}>Content Goals (Multi-select)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {[
                                            { id: 'engagement', label: 'Engagement' },
                                            { id: 'followers-growth', label: 'Growth' },
                                            { id: 'lead-gen', label: 'Leads' },
                                            { id: 'sales', label: 'Sales' },
                                            { id: 'thought-leadership', label: 'Authority' }
                                        ].map(g => (
                                            <label key={g.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '6px 12px', backgroundColor: '#27272a', borderRadius: '6px',
                                                fontSize: '13px', cursor: 'pointer',
                                                border: draftConfig.brand.goals?.includes(g.id as any) ? '1px solid #8b5cf6' : '1px solid transparent'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={draftConfig.brand.goals?.includes(g.id as any)}
                                                    onChange={e => {
                                                        const current = draftConfig.brand.goals || [];
                                                        const next = e.target.checked
                                                            ? [...current, g.id as any]
                                                            : current.filter(x => x !== g.id);
                                                        // Also update primary goal to first selected if simplified
                                                        setDraftConfig(prev => ({
                                                            ...prev,
                                                            goal: next[0] || prev.goal, // Fallback to avoid empty
                                                            brand: { ...prev.brand, goals: next },
                                                            customMix: undefined // Reset custom mix on goal change
                                                        }));
                                                    }}
                                                    style={{ display: 'none' }}
                                                />
                                                {g.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Timeframe</label>
                                        <div style={{ position: 'relative' }}>
                                            <select
                                                value={draftConfig.timeframe}
                                                onChange={(e) => setDraftConfig(prev => ({ ...prev, timeframe: e.target.value as Timeframe }))}
                                                style={{ width: '100%', padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', appearance: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="2-weeks">2 Weeks</option>
                                                <option value="1-month">1 Month</option>
                                                <option value="3-months">3 Months</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Planning Month</label>
                                        <input
                                            type="month"
                                            value={draftConfig.planningMonth}
                                            onChange={e => setDraftConfig(prev => ({ ...prev, planningMonth: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', colorScheme: 'dark', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cohort Mix (Manual Override) */}
                        <div style={{ backgroundColor: '#18181b', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>Content Mix</h3>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>Adjusting will override goal defaults.</p>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        checked={isAiStrategyOn}
                                        onChange={e => setIsAiStrategyOn(e.target.checked)}
                                        style={{ accentColor: '#10b981' }}
                                    />
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: isAiStrategyOn ? '#10b981' : '#71717a' }}>
                                        {isSuggesting ? 'AI Suggesting...' : 'AI Suggestion'}
                                    </span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {(['Educational', 'Product', 'Brand', 'Community'] as CohortType[]).map(cohort => {
                                    // Determine current value
                                    const primaryGoal = mapToPrimaryGoal(draftConfig.goal);
                                    const defaultValue = GOAL_COHORT_DISTRIBUTION[primaryGoal][cohort];
                                    const currentValue = draftConfig.customMix ? (draftConfig.customMix[cohort] || 0) : defaultValue;

                                    const colorKey = cohort.toLowerCase() as keyof CohortMix;

                                    return (
                                        <div key={cohort} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                <span style={{ fontWeight: '600', color: '#d4d4d8' }}>{cohort}</span>
                                                <span style={{ color: '#a1a1aa' }}>{Math.round(currentValue)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1" // Allow fine grain since we auto-calc
                                                value={currentValue}
                                                onChange={(e) => {
                                                    const newValue = parseInt(e.target.value);

                                                    // SMART BALANCING LOGIC
                                                    setDraftConfig(prev => {
                                                        const pGoal = mapToPrimaryGoal(prev.goal);
                                                        const oldMix = prev.customMix || { ...GOAL_COHORT_DISTRIBUTION[pGoal] };

                                                        // 1. Calculate how much we need to distribute to others
                                                        const targetRemainder = 100 - newValue;
                                                        const otherKeys = (Object.keys(oldMix) as CohortType[]).filter(k => k !== cohort);

                                                        // 2. Calculate current total of others
                                                        const currentOtherTotal = otherKeys.reduce((sum, key) => sum + oldMix[key], 0);

                                                        const newMix = { ...oldMix, [cohort]: newValue };

                                                        if (currentOtherTotal === 0) {
                                                            // Edge case: Others were 0, distribute remainder equally
                                                            if (targetRemainder > 0) {
                                                                const split = targetRemainder / otherKeys.length;
                                                                otherKeys.forEach(k => newMix[k] = split);
                                                            }
                                                        } else {
                                                            // 3. Proportional reduction/increase
                                                            // Formula: NewOther = OldOther * (TargetRemainder / OldOtherTotal)
                                                            const ratio = targetRemainder / currentOtherTotal;
                                                            otherKeys.forEach(k => {
                                                                newMix[k] = oldMix[k] * ratio;
                                                            });
                                                        }

                                                        // 4. Rounding cleanup to ensure exact 100 (assign dust to largest other)
                                                        let roundedSum = 0;
                                                        let maxOtherKey = otherKeys[0];

                                                        // Round all except the main one we are dragging (keep that precise if possible, or integer)
                                                        // actually slider is integer, so we treat 'newValue' as fixed
                                                        otherKeys.forEach(k => {
                                                            newMix[k] = Math.round(newMix[k]);
                                                            if (newMix[k] > newMix[maxOtherKey]) maxOtherKey = k;
                                                            roundedSum += newMix[k];
                                                        });

                                                        const finalDust = 100 - (newValue + roundedSum);
                                                        // Add dust to the largest other to minimize visual jumpiness
                                                        if (finalDust !== 0 && maxOtherKey) {
                                                            newMix[maxOtherKey] += finalDust;
                                                        }

                                                        return {
                                                            ...prev,
                                                            customMix: newMix
                                                        };
                                                    })
                                                }}
                                                disabled={isAiStrategyOn}
                                                style={{
                                                    width: '100%',
                                                    accentColor: getColor(colorKey),
                                                    opacity: isAiStrategyOn ? 0.4 : 1,
                                                    cursor: isAiStrategyOn ? 'not-allowed' : 'pointer'
                                                }}
                                            />
                                        </div>
                                    );
                                })}

                                {/* Always 100% confirmation */}
                                <div style={{ fontSize: '11px', color: isAiStrategyOn ? '#10b981' : '#10b981', marginTop: '4px', textAlign: 'center' }}>
                                    {isAiStrategyOn ? '✨ AI Optimized Balance: 100%' : 'Smart Balanced: 100%'}
                                </div>
                            </div>
                        </div>

                        {/* Insights */}
                        <div style={{ backgroundColor: '#18181b', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>Data & Context</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Key Insight Source (CSV)</label>
                                    <label style={{
                                        padding: '12px',
                                        backgroundColor: draftConfig.uploadStatus ? 'rgba(16, 185, 129, 0.1)' : '#27272a',
                                        color: draftConfig.uploadStatus ? '#10b981' : '#a1a1aa',
                                        border: draftConfig.uploadStatus ? '1px solid rgba(16, 185, 129, 0.2)' : '1px dashed #52525b',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontWeight: '500'
                                    }}>
                                        {draftConfig.uploadStatus ? `✓ ${draftConfig.uploadStatus.filename}` : '+ Upload Performance Data'}
                                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Target Audience</label>
                                    <input
                                        value={draftConfig.brand.audience}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, audience: e.target.value } }))}
                                        placeholder="e.g. CMOs, New Moms"
                                        style={{ padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: '1px solid transparent', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Sensitivity / Constraints <span style={{ fontWeight: '400', opacity: 0.7 }}>(Optional)</span></label>
                                    <input
                                        value={draftConfig.brand.sensitivity?.join(', ') || ''}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, sensitivity: e.target.value.split(',').map(s => s.trim()) } }))}
                                        placeholder="e.g. No selling, formal tone"
                                        style={{ padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: '1px solid transparent', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Visual References <span style={{ fontWeight: '400', opacity: 0.7 }}>(Optional)</span></label>
                                    <input
                                        value={draftConfig.brand.references?.join(', ') || ''}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, references: e.target.value.split(',').map(s => s.trim()) } }))}
                                        placeholder="Paste links..."
                                        style={{ padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: '1px solid transparent', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Core USP</label>
                                    <textarea
                                        value={draftConfig.brand.usp}
                                        onChange={e => setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, usp: e.target.value } }))}
                                        placeholder="What distinguishes this brand?"
                                        style={{ flex: 1, padding: '10px 12px', backgroundColor: '#27272a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', resize: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Operations Toolbar */}
                <section style={{
                    backgroundColor: '#18181b',
                    borderRadius: '12px',
                    padding: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #27272a'
                }}>
                    <div style={{ display: 'flex', gap: '12px', paddingLeft: '8px', overflowX: 'auto' }}>
                        <div />

                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleRebalance}
                            disabled={isDirty || !isValid}
                            style={{
                                padding: '10px 16px',
                                background: 'transparent',
                                color: '#71717a',
                                border: '1px solid transparent',
                                borderRadius: '8px',
                                cursor: (isDirty || !isValid) ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                fontSize: '13px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { if (!isDirty) e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { if (!isDirty) e.currentTarget.style.color = '#71717a' }}
                        >
                            ⚖️ Balance Mix
                        </button>
                        <button
                            onClick={handleGenerateAll}
                            disabled={isGeneratingAll || !isValid}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: (isGeneratingAll || !isValid) ? '#27272a' : '#fff',
                                color: (isGeneratingAll || !isValid) ? '#52525b' : '#000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: (isGeneratingAll || !isValid) ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: (isGeneratingAll || !isValid) ? 'none' : '0 0 20px rgba(255,255,255,0.1)'
                            }}
                        >
                            {isGeneratingAll ? <Spinner size={14} color="#000" /> : '⚡ Generate Calendar'}
                        </button>
                    </div>
                </section>

                {error && (
                    <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.2)', color: '#f87171', padding: '16px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                {/* 3. Output Section */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Active Schedule</div>
                            <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0, color: '#fff', letterSpacing: '-0.02em', lineHeight: '1' }}>
                                {new Date(activeConfig.planningMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h2>
                        </div>

                        <div style={{ display: 'flex', gap: '2px', backgroundColor: '#18181b', padding: '4px', borderRadius: '10px', border: '1px solid #27272a' }}>
                            <button
                                onClick={() => setView('calendar')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: view === 'calendar' ? '#27272a' : 'transparent',
                                    color: view === 'calendar' ? '#fff' : '#71717a',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Calendar
                            </button>
                            <button
                                onClick={() => setView('list')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: view === 'list' ? '#27272a' : 'transparent',
                                    color: view === 'list' ? '#fff' : '#71717a',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                List
                            </button>
                            <div style={{ width: '1px', backgroundColor: '#3f3f46', margin: '4px 8px' }}></div>
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={isExporting || normalizedPosts.length === 0}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: 'transparent',
                                        color: '#e4e4e7',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isExporting ? <Spinner size={12} color="#fff" /> : 'Export ▾'}
                                </button>
                                {showExportMenu && (
                                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '4px', zIndex: 60, width: '120px', boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                                        <button onClick={() => handleExport('csv')} style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#27272a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>CSV</button>
                                        <button onClick={() => handleExport('xlsx')} style={{ display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '13px', cursor: 'pointer', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#27272a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Excel</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* View Content */}
                    <div style={{ opacity: isGeneratingAll ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                        {view === 'calendar' ? (
                            <CalendarGrid
                                posts={normalizedPosts}
                                isGeneratingAll={isGeneratingAll}
                                generatingPostIds={generatingPostIds}
                                onRegenerateWeek={handleRegenerateWeek}
                                onStop={handleStopGeneration}
                            />
                        ) : (
                            <ListView posts={normalizedPosts} onRegenerate={handleRegeneratePost} isGeneratingAll={isGeneratingAll} generatingPostIds={generatingPostIds} />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ContentCalendarPage;
