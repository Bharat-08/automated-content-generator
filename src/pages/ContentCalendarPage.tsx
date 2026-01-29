import { useState, useMemo, useEffect, useRef } from 'react';
import CalendarGrid from '../components/CalendarGrid';
import ListView from '../components/ListView';
import { mockPosts, type SocialPost } from '../data/mockPosts';
import { generateDateSlots } from '../utils/dateSlotGenerator';
import { mapCohortToFunnel } from '../utils/postDerivations';
import { type ContentGoal } from '../utils/cohortLogic';
import { type BrandProfile, generateContentIdea } from '../utils/aiGenerator';
import { parseCSV } from '../utils/csvParser';
import { normalizeCalendar, type NormalizedPost } from '../utils/normalizePost';
import { type PrimaryGoal } from '../utils/platformFrequency';
import { calculateGoalToCohort, type CohortType } from '../utils/goalToCohort';
import { decidePostFormat } from '../utils/formatDecider';
import { analyzePerformance, type PerformanceSignals } from '../utils/performanceAnalyzer';
import { exportContent } from '../utils/exportCsv';
import RegenerateWeekModal from '../components/RegenerateWeekModal';
import RegeneratePostModal from '../components/RegeneratePostModal';
import { scheduleCalendar, type UnscheduledRequirement } from '../utils/scheduleCalendar';
import { type ScheduledPost } from '../utils/hardConstraints';
import { mapCohortToBoatPillar } from '../utils/postDerivations';

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
};

const ContentCalendarPage = () => {
    const [posts, setPosts] = useState(mockPosts);
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [, setLastChanges] = useState<string[]>([]);

    // Staged Configuration
    const [draftConfig, setDraftConfig] = useState<StrategyConfig>(INITIAL_CONFIG);
    const [activeConfig, setActiveConfig] = useState<StrategyConfig>(INITIAL_CONFIG);

    const mapToPrimaryGoal = (goal: ContentGoal): PrimaryGoal => {
        return goal as PrimaryGoal;
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
        start.setHours(12, 0, 0, 0); // Start at Noon to avoid timezone shifts during iteration

        // 2. Prepare Requirements for Scheduler
        const totalPostCount = slots.length;
        const timeframeWeeks = config.timeframe === '2-weeks' ? 2 : config.timeframe === '1-month' ? 4 : 12;

        const cohortCounts = calculateGoalToCohort({
            primaryGoal,
            timeframeWeeks,
            totalPostCount
        });

        const requirements: UnscheduledRequirement[] = [];
        Object.entries(cohortCounts).forEach(([cohort, count]) => {
            for (let i = 0; i < count; i++) {
                requirements.push({
                    cohort: cohort as CohortType,
                    // Format will be decided INSIDE scheduleCalendar or during assignment
                    // For now, satisfy the interface by pre-shuffling formats in the requirements pool
                    platform: 'LinkedIn', // Placeholder, scheduleCalendar will match platforms
                    format: decidePostFormat('LinkedIn', cohort as CohortType, primaryGoal)
                });
            }
        });

        // 3. Re-map requirements to satisfy the scheduler's per-platform needs
        // The scheduler needs requirements that are specifically mapped to platforms
        // if we want to ensure exact counts.
        const platformRequirements: UnscheduledRequirement[] = [];
        // Distribute cohorts across platforms as requirements
        let reqIdx = 0;
        const cohortPoolShuffled = [...requirements].sort(() => Math.random() - 0.5);

        if (cohortPoolShuffled.length === 0) {
            console.error("Critical: No requirements generated. Defaulting to Educational.");
            cohortPoolShuffled.push({ cohort: 'Founders' }); // Fallback
        }

        slots.forEach((slot) => {
            const req = cohortPoolShuffled[reqIdx % cohortPoolShuffled.length];
            platformRequirements.push({
                cohort: req.cohort,
                platform: slot.platform,
                format: decidePostFormat(slot.platform, req.cohort, primaryGoal)
            });
            reqIdx++;
        });

        // 4. Run Scheduler
        // IMPORTANT: history MUST have Date objects, not strings, or scheduler crashes on .toISOString()
        const history: ScheduledPost[] = currentPosts
            .filter(p => {
                const d = new Date(p.date + 'T12:00:00');
                return d < start || d > end;
            })
            .map(p => ({
                id: p.id,
                cohort: p.pillar as any,
                platform: p.platform as any,
                format: p.format as any,
                date: new Date(p.date + 'T12:00:00'),
                funnel: p.funnel as any,
                boatPillar: mapCohortToBoatPillar(p.pillar as any)
            }));



        let scheduledPosts: ScheduledPost[] = [];
        try {
            scheduledPosts = scheduleCalendar(
                start,
                end,
                platformRequirements,
                primaryGoal,
                history
            );
        } catch (e) {
            console.error("Scheduler crashed:", e);
            // Fallback: simple mapping if intelligent scheduler fails
            scheduledPosts = platformRequirements.map((req, i) => ({
                id: `fallback-${i}`,
                date: new Date(start.getTime() + (i * 86400000)), // Approximate day increment
                platform: req.platform as any,
                cohort: req.cohort as any,
                format: req.format as any,
                funnel: 'Awareness',
                boatPillar: 'Founders',
                coreMessage: 'Fallback content due to high volume',
                hook: 'Simplified schedule'
            } as ScheduledPost));
        }

        // 6. Strict Platform Enforcement (Defensive)
        // Ensure no platforms slipped in that aren't in the config
        const allowedPlatforms = new Set(config.brand.platforms);
        scheduledPosts = scheduledPosts.filter(p => allowedPlatforms.has(p.platform));

        // 5. Convert back to SocialPost for the UI
        const finalPosts: SocialPost[] = scheduledPosts.map((p, idx) => {
            let dateStr = '';
            try {
                // Ensure p.date is valid before calling toISOString
                const d = p.date instanceof Date ? p.date : new Date(p.date);
                if (isNaN(d.getTime())) throw new Error('Invalid Date');
                dateStr = d.toISOString().split('T')[0];
            } catch (e) {
                console.error("Critical Error: Invalid date encountered for post", p, e);
                // Fallback to avoid crashing the UI
                dateStr = new Date().toISOString().split('T')[0];
            }

            return {
                id: p.id || `new-${dateStr}-${p.platform}-${idx}`,
                date: dateStr,
                platform: p.platform as any,
                funnel: p.funnel as any || mapCohortToFunnel(p.cohort),
                cohort: 'Founders',
                pillar: p.cohort as any,
                format: p.format as any,
                coreMessage: p.coreMessage || '',
                hook: p.postCommunication || '',
                event: p.event
            };
        });

        return finalPosts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    // New: Regenerate specific week with options from Modal
    const handleConfirmRegeneration = async (data: { mix: Record<CohortType, number>; instruction: string }) => {
        if (!regenerateRange) return;

        setRegenerateModalOpen(false); // Close modal

        const rangeStart = regenerateRange.start;
        const rangeEnd = regenerateRange.end;
        const startDateStr = rangeStart.toISOString().split('T')[0];
        const endDateStr = rangeEnd.toISOString().split('T')[0];

        const config = activeConfig;
        const primaryGoal = mapToPrimaryGoal(config.goal);

        setLastChanges(['Regenerating week...']);

        try {
            // STRATEGY:
            // 1. Identify "Slots" to fill.
            //    Priority A: Use EXISTING posts in this week (maintains schedule).
            //    Priority B: Generate new slots using settings (if week matches plan).
            //    Priority C: Fallback to 1 post/day (if everything else fails).

            const existingWeekPosts = posts.filter(p => p.date >= startDateStr && p.date <= endDateStr);

            let targetSlots: { date: Date; platform: any }[] = [];

            if (existingWeekPosts.length > 0) {
                targetSlots = existingWeekPosts.map(p => ({
                    date: new Date(p.date), // This might set time to 00:00 locally
                    platform: p.platform
                }));
            } else {
                // Try generator
                const allSlots = generateDateSlots({
                    planningMonth: config.planningMonth,
                    timeframe: config.timeframe,
                    primaryGoal,
                    activePlatforms: config.brand.platforms as any || [],
                    performanceSignals: config.performanceSignals || undefined
                });
                targetSlots = allSlots.filter(s => s.date >= rangeStart && s.date <= rangeEnd);
            }

            // Fallback: If still 0, ensure we produce something (1/day)
            if (targetSlots.length === 0) {
                const ptr = new Date(rangeStart);
                const platforms = config.brand.platforms as any || ['LinkedIn'];
                let pIdx = 0;
                // Safety break to prevent infinite loops if dates broken
                let safety = 0;
                while (ptr <= rangeEnd && safety < 14) {
                    targetSlots.push({
                        date: new Date(ptr),
                        platform: platforms[pIdx % platforms.length]
                    });
                    ptr.setDate(ptr.getDate() + 1);
                    pIdx++;
                    safety++;
                }
            }

            if (targetSlots.length === 0) {
                // If STILL empty (e.g. invalid range), generic error
                throw new Error("Invalid date range for regeneration");
            }

            // 3. Prepare Requirements Pool
            const cohortCounts = calculateGoalToCohort({
                primaryGoal,
                timeframeWeeks: 1, // Specific week
                totalPostCount: targetSlots.length,
                customMix: data.mix
            });

            const platformRequirements: UnscheduledRequirement[] = [];

            // Distribute as requirements pool
            const requirements: { cohort: CohortType }[] = [];
            Object.entries(cohortCounts).forEach(([cohort, count]) => {
                for (let i = 0; i < count; i++) requirements.push({ cohort: cohort as CohortType });
            });

            // Shuffle pool
            const shuffledPool = [...requirements].sort(() => Math.random() - 0.5);

            targetSlots.forEach((slot, idx) => {
                const req = shuffledPool[idx % shuffledPool.length];
                platformRequirements.push({
                    cohort: req.cohort,
                    platform: slot.platform,
                    format: decidePostFormat(slot.platform, req.cohort, primaryGoal)
                });
            });

            // 4. Run Scheduler for replacement week
            // IMPORTANT: history MUST have Date objects, not strings
            const history: ScheduledPost[] = posts
                .filter(p => p.date < startDateStr || p.date > endDateStr)
                .map(p => ({
                    id: p.id,
                    cohort: p.pillar as any,
                    platform: p.platform as any,
                    format: p.format as any,
                    date: new Date(p.date + 'T12:00:00'),
                    funnel: p.funnel as any,
                    boatPillar: mapCohortToBoatPillar(p.pillar as any)
                }));

            const scheduledPostsInWeek = scheduleCalendar(
                rangeStart,
                rangeEnd,
                platformRequirements,
                primaryGoal,
                history
            ).filter(p => p.date >= rangeStart && p.date <= rangeEnd);

            // 5. Convert to SocialPost format for UI
            const newWeekPosts: SocialPost[] = scheduledPostsInWeek.map((p, idx) => {
                const dateStr = p.date instanceof Date
                    ? p.date.toISOString().split('T')[0]
                    : new Date(p.date).toISOString().split('T')[0];
                return {
                    id: p.id || `regen-${dateStr}-${p.platform}-${Date.now()}-${idx}`,
                    date: dateStr,
                    platform: p.platform as any,
                    funnel: p.funnel as any || mapCohortToFunnel(p.cohort),
                    cohort: 'Founders', // This should probably be p.cohort or derived from it
                    pillar: p.cohort as any,
                    format: p.format as any,
                    coreMessage: '', // AI will fill
                    hook: ''
                };
            });

            // 6. Generate Content (AI)
            const generatedPosts: SocialPost[] = [];

            // Update UI with loading skeletons
            const newIds = new Set(newWeekPosts.map(p => p.id));
            setGeneratingPostIds(prev => {
                const next = new Set(prev);
                newIds.forEach(id => next.add(id));
                return next;
            });

            // Keep reference to preserved posts
            const preservedPosts = posts.filter(p => p.date < startDateStr || p.date > endDateStr);
            setPosts([...preservedPosts, ...newWeekPosts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

            for (const post of newWeekPosts) {
                try {
                    const idea = await generateContentIdea(
                        config.brand,
                        config.goal as any,
                        post,
                        config.performanceSignals || undefined,
                        data.instruction
                    );

                    generatedPosts.push({
                        ...post,
                        coreMessage: idea.coreMessage,
                        hook: idea.postCommunication
                    });
                } catch (e) {
                    generatedPosts.push({
                        ...post,
                        coreMessage: "Generation failed",
                        hook: "Please try regenerating individually."
                    });
                }
            }

            // 7. Final Update
            setPosts([...preservedPosts, ...generatedPosts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            setLastChanges([`Regenerated week of ${startDateStr}`]);


        } catch (err) {
            console.error(err);
            setError("Failed to regenerate week.");
        } finally {
            setGeneratingPostIds(() => {
                // In reality we should remove `newIds`, but local scope closed.
                // Clearing all is OK for this prototype interaction.
                return new Set();
            });
        }
    };

    const handleUpdatePost = (id: string, updates: Partial<NormalizedPost>) => {
        setStagedEdits(prev => {
            const current = prev[id] || {};
            return {
                ...prev,
                [id]: {
                    ...current,
                    // Map NormalizedPost fields back to SocialPost fields
                    ...(updates.coreMessage !== undefined ? { coreMessage: updates.coreMessage } : {}),
                    ...(updates.postCommunication !== undefined ? { hook: updates.postCommunication } : {})
                }
            };
        });
    };

    const handleSaveChanges = async () => {
        if (Object.keys(stagedEdits).length === 0) return;

        setIsSavingChanges(true);
        setError(null);

        try {
            // Simulate API call (PATCH /api/schedules)
            await new Promise(resolve => setTimeout(resolve, 1500));

            setPosts(prev => prev.map(p => {
                if (stagedEdits[p.id]) {
                    return { ...p, ...stagedEdits[p.id] };
                }
                return p;
            }));

            setStagedEdits({});
            setLastChanges(['All changes saved successfully.']);
            setTimeout(() => setLastChanges([]), 3000);
        } catch (err) {
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSavingChanges(false);
        }
    };

    useEffect(() => {
        // Initial load: don't pass mockPosts if we want to simulate empty start, 
        // but for dev we load mockPosts. 
        const initial = syncCalendarToConfig(INITIAL_CONFIG, mockPosts);
        setPosts(initial);

        // Data is now loaded (locally in this prototype)
        setIsFetchingData(false);
    }, []);

    // dirty check
    const isDirty = useMemo(() => {
        return JSON.stringify(draftConfig) !== JSON.stringify(activeConfig);
    }, [draftConfig, activeConfig]);

    // UI States
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true); // New: Tracks initial data load
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [showPerformanceTooltip, setShowPerformanceTooltip] = useState(false);

    // Regeneration Modal State
    const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
    const [regenerateRange, setRegenerateRange] = useState<{ start: Date; end: Date } | null>(null);
    const [isRegeneratePostModalOpen, setIsRegeneratePostModalOpen] = useState(false);

    const [selectedPostForRegen, setSelectedPostForRegen] = useState<SocialPost | null>(null);

    // Editing State
    const [stagedEdits, setStagedEdits] = useState<Record<string, Partial<SocialPost>>>({});
    const [isSavingChanges, setIsSavingChanges] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Initial open modal handler
    const onRegenerateWeekRequest = (start: Date, end: Date) => {
        setRegenerateRange({ start, end });
        setRegenerateModalOpen(true);
    };


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


    const normalizedPosts = useMemo(() => {
        // Map SocialPost (current state) to ScheduledPost-like structure for normalization
        const scheduledLike = filteredPosts.map(p => {
            // Apply staged edits for the UI only
            const edits = stagedEdits[p.id] || {};
            return {
                cohort: p.pillar,
                platform: p.platform as any,
                format: p.format as any,
                date: new Date(p.date),
                coreMessage: edits.coreMessage !== undefined ? edits.coreMessage : p.coreMessage,
                postCommunication: edits.hook !== undefined ? edits.hook : p.hook
            };
        });

        return normalizeCalendar(scheduledLike, activeConfig.brand, activeConfig.goal as any);
    }, [filteredPosts, activeConfig.brand, activeConfig.goal, stagedEdits]);

    const handleApplyChanges = () => {
        setActiveConfig(draftConfig);
        const synced = syncCalendarToConfig(draftConfig, posts);
        setPosts(synced);
        setLastChanges(['Strategy applied successfully. Full schedule generated.']);
        setTimeout(() => setLastChanges([]), 5000);
    };

    const handleConfirmPostRegeneration = async (instruction: string) => {
        if (!selectedPostForRegen) return;

        const postId = selectedPostForRegen.id;
        setIsRegeneratePostModalOpen(false); // Close immediately
        setError(null);

        setGeneratingPostIds(prev => new Set(prev).add(postId));
        setLastChanges([`Regenerating post for ${selectedPostForRegen.platform}...`]);

        try {
            // Small delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 600));

            const idea = await generateContentIdea(
                activeConfig.brand,
                activeConfig.goal as any,
                selectedPostForRegen,
                activeConfig.performanceSignals || undefined,
                instruction
            );

            if (idea.coreMessage === "Post idea unavailable") {
                throw new Error("AI failed to generate a valid idea.");
            }

            // Update only the specific post
            setPosts((prevPosts: SocialPost[]) => prevPosts.map((p: SocialPost) =>
                p.id === postId
                    ? { ...p, coreMessage: idea.coreMessage, hook: idea.postCommunication }
                    : p
            ));
            setLastChanges([`Regenerated post for ${selectedPostForRegen.platform}`]);

        } catch (err: any) {
            setError(err.message || "Failed to regenerate post.");
        } finally {
            setGeneratingPostIds(prev => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
            setSelectedPostForRegen(null);
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

            for (let i = 0; i < postIds.length; i++) {
                const postId = postIds[i];
                // Check for stop signal
                if (stopGenerationRef.current) {
                    console.log("Generaton stop signal received. Breaking loop.");
                    break;
                }

                // We use 'newPosts' here because state 'posts' might not be updated inside this closure yet
                const currentPost = newPosts.find(p => p.id === postId);
                if (!currentPost) continue;

                setGeneratingPostIds(prev => new Set(prev).add(postId));

                try {
                    await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay

                    console.log(`[Generator] Generating ${i + 1}/${postIds.length} (${postId})`);
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
                    console.warn(`[Generator] Failed for ${postId}`, err);
                    failCount++;
                } finally {
                    setGeneratingPostIds(prev => {
                        const next = new Set(prev);
                        next.delete(postId);
                        return next;
                    });
                }

                // Double check stop after await
                if (stopGenerationRef.current) break;
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
            console.error("CRITICAL GENERATION FAILURE:", err);
            setError("Bulk generation encountered a critical error.");
        } finally {
            console.log("[Generator] Loop finished. Clearing state.");
            setIsGeneratingAll(false);
            stopGenerationRef.current = false;
        }
    };

    const handleExport = async (format: 'csv' | 'xlsx' = 'csv') => {
        if (normalizedPosts.length === 0 || isExporting) return;

        setIsExporting(true);
        setShowExportMenu(false);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            const [year] = activeConfig.planningMonth.split('-');
            const monthName = new Date(activeConfig.planningMonth + '-01').toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
            const filename = `content_schedule_${monthName}_${year}`;
            exportContent(normalizedPosts, filename, format);
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
                        <h1 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.03em', margin: 0, color: '#fafafa' }}>Content<span style={{ color: '#4f46e5' }}>AI</span></h1>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', color: (isDirty || !isValid) ? '#f59e0b' : '#10b981', fontWeight: '600', transition: 'color 0.3s' }}>
                            {isDirty ? '● Unsaved Changes' : '● System Ready'}
                        </div>
                        {view === 'list' && (
                            <div style={{ display: 'flex', gap: '8px', borderRight: '1px solid #27272a', paddingRight: '16px', marginRight: '8px' }}>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#27272a',
                                            color: '#fafafa',
                                            border: '1px solid #3f3f46',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            fontSize: '13px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Edit Content
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setStagedEdits({});
                                                setIsEditing(false);
                                            }}
                                            style={{
                                                padding: '8px 16px',
                                                backgroundColor: 'transparent',
                                                color: '#a1a1aa',
                                                border: '1px solid #27272a',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                await handleSaveChanges();
                                                setIsEditing(false);
                                            }}
                                            disabled={isSavingChanges || Object.keys(stagedEdits).length === 0}
                                            style={{
                                                padding: '8px 16px',
                                                backgroundColor: '#4f46e5',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: (isSavingChanges || Object.keys(stagedEdits).length === 0) ? 'not-allowed' : 'pointer',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                transition: 'all 0.2s',
                                                opacity: (isSavingChanges || Object.keys(stagedEdits).length === 0) ? 0.5 : 1
                                            }}
                                        >
                                            {isSavingChanges ? <Spinner /> : 'Save Changes'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
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

            {isRegeneratePostModalOpen && selectedPostForRegen && (
                <RegeneratePostModal
                    isOpen={isRegeneratePostModalOpen}
                    onClose={() => setIsRegeneratePostModalOpen(false)}
                    onConfirm={handleConfirmPostRegeneration}
                    postDate={selectedPostForRegen.date}
                    platform={selectedPostForRegen.platform}
                />
            )}

            <RegenerateWeekModal
                isOpen={regenerateModalOpen}
                onClose={() => setRegenerateModalOpen(false)}
                onConfirm={handleConfirmRegeneration}
                startDate={regenerateRange?.start || new Date()}
                endDate={regenerateRange?.end || new Date()}
                primaryGoal={mapToPrimaryGoal(activeConfig.goal)}
            />


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
                                                        if (e.target.checked) {
                                                            const next = [...current, p];
                                                            setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, platforms: next } }));
                                                        } else {
                                                            const next = current.filter(x => x !== p);
                                                            setDraftConfig(prev => ({ ...prev, brand: { ...prev.brand, platforms: next } }));
                                                        }
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
                                            { id: 'followers-growth', label: 'Followers Growth' },
                                            { id: 'traffic', label: 'Traffic' },
                                            { id: 'lead-gen', label: 'Lead-gen' },
                                            { id: 'sales', label: 'Sales' },
                                            { id: 'thought-leadership', label: 'Thought Leadership' }
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
                                                            brand: { ...prev.brand, goals: next }
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

                        {/* Insights (Data & Context) */}
                        <div style={{ backgroundColor: '#18181b', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>Data & Context</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#71717a' }}>Key Insight Source (CSV)</label>
                                        <div
                                            onMouseEnter={() => setShowPerformanceTooltip(true)}
                                            onMouseLeave={() => setShowPerformanceTooltip(false)}
                                            onClick={() => setShowPerformanceTooltip(!showPerformanceTooltip)}
                                            style={{
                                                cursor: 'pointer',
                                                color: '#fff',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                backgroundColor: '#3f3f46',
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                lineHeight: 1
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.backgroundColor = '#52525b';
                                                e.currentTarget.style.transform = 'scale(1.1)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.backgroundColor = '#3f3f46';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                            aria-label="What should your performance data include?"
                                        >
                                            i
                                        </div>

                                        {showPerformanceTooltip && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '24px',
                                                left: '0',
                                                zIndex: 100,
                                                width: '300px',
                                                backgroundColor: '#18181b',
                                                border: '1px solid #27272a',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                                pointerEvents: 'none'
                                            }}>
                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#fff' }}>What should your performance data include?</h4>
                                                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a1a1aa', lineHeight: '1.4' }}>For best results, include the following fields in your CSV:</p>
                                                <ul style={{ margin: '0 0 12px 0', padding: '0 0 0 18px', fontSize: '12px', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <li>Active days (posting frequency or dates)</li>
                                                    <li>Type of post (Carousel, Reel, Static)</li>
                                                    <li>Reach (number of accounts reached)</li>
                                                    <li>Engagement metrics:
                                                        <ul style={{ paddingLeft: '14px', marginTop: '4px', listStyleType: 'circle' }}>
                                                            <li>Likes</li>
                                                            <li>Comments</li>
                                                            <li>Shares</li>
                                                            <li>Clicks</li>
                                                        </ul>
                                                    </li>
                                                    <li>Followers gained from the content</li>
                                                </ul>
                                                <p style={{ margin: 0, fontSize: '10px', color: '#71717a', fontStyle: 'italic' }}>More accurate data helps generate better content recommendations.</p>
                                            </div>
                                        )}
                                    </div>
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

                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => {
                                        setShowExportMenu(!showExportMenu);
                                    }}
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
                                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '4px', zIndex: 60, width: '140px', boxShadow: '0 10px 15px rgba(0,0,0,0.5)' }}>
                                        <button onClick={() => handleExport('csv')} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: '#e4e4e7', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#27272a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Download CSV</button>
                                        <button onClick={() => handleExport('xlsx')} style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: '#e4e4e7', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#27272a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Download Excel</button>
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
                                isLoading={isFetchingData}
                                isGeneratingAll={isGeneratingAll}
                                generatingPostIds={generatingPostIds}
                                onRegenerateWeek={onRegenerateWeekRequest}
                                onStop={handleStopGeneration}
                            />
                        ) : (
                            <ListView
                                posts={normalizedPosts}
                                isLoading={isFetchingData}
                                onRegenerateWeek={onRegenerateWeekRequest}
                                isGeneratingAll={isGeneratingAll}
                                generatingPostIds={generatingPostIds}
                                onUpdatePost={handleUpdatePost}
                                onStop={handleStopGeneration}
                                isEditing={isEditing}
                            />
                        )}
                    </div>
                </section>
            </main>

            {/* Fixed Save Bar */}
            {Object.keys(stagedEdits).length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Unsaved changes</span>
                            <span style={{ fontSize: '11px', color: '#71717a' }}>{Object.keys(stagedEdits).length} post{Object.keys(stagedEdits).length > 1 ? 's' : ''} modified</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setStagedEdits({})}
                                disabled={isSavingChanges}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'transparent',
                                    color: '#a1a1aa',
                                    border: '1px solid #27272a',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: isSavingChanges ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSaveChanges}
                                disabled={isSavingChanges}
                                style={{
                                    padding: '8px 20px',
                                    backgroundColor: '#fff',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: isSavingChanges ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isSavingChanges ? (
                                    <>
                                        <Spinner size={14} color="#000" />
                                        Saving...
                                    </>
                                ) : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                    <style>{`
                        @keyframes slideUp {
                            from { transform: translate(-50%, 20px); opacity: 0; }
                            to { transform: translate(-50%, 0); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default ContentCalendarPage;
