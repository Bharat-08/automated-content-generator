import { generateDateSlots } from './dateSlotGenerator';
import { scheduleCalendar, UnscheduledRequirement } from './scheduleCalendar';
import { ScheduledPost } from './hardConstraints';
import { PostFormat } from './formatDecider';
import { Platform } from './platformFrequency';

const runDebug = () => {
    console.log("Starting Debug...");

    const platforms: Platform[] = ['LinkedIn', 'Instagram'];

    const config = {
        planningMonth: '2026-02',
        timeframe: '1-month' as const,
        primaryGoal: 'engagement' as const,
        activePlatforms: platforms as any,
        performanceSignals: undefined
    };

    // 1. Generate Slots
    const slots = generateDateSlots(config);
    console.log(`Generated Slots Count: ${slots.length}`);
    console.log(`First Slot Date: ${slots[0].date.toISOString()}`);
    console.log(`Last Slot Date: ${slots[slots.length - 1].date.toISOString()}`);

    // Check distribution
    const fromDate = slots[0].date;
    const toDate = slots[slots.length - 1].date;
    const days = (toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24) + 1;
    console.log(`Days covered by slots: ${days}`);

    // 2. Mock converting to requirements (simplified)
    const platformRequirements: UnscheduledRequirement[] = slots.map((s, i) => ({
        cohort: 'Value',
        platform: s.platform,
        format: 'text' as PostFormat
    }));

    console.log(`Requirements Count: ${platformRequirements.length}`);

    // 3. Run Scheduler
    const start = new Date(2026, 1, 1); // Feb 1
    const end = new Date(2026, 1, 28, 23, 59, 59);

    const scheduled = scheduleCalendar(start, end, platformRequirements, 'engagement', []);

    console.log(`Scheduled Posts Count: ${scheduled.length}`);

    // Analyze coverage
    const scheduledDates = scheduled.map(p => p.date.toISOString().split('T')[0]);
    const uniqueDates = new Set(scheduledDates);
    console.log(`Unique Dates Scheduled: ${uniqueDates.size}`);
    console.log(`First Scheduled: ${scheduledDates[0]}`);
    console.log(`Last Scheduled: ${scheduledDates[scheduledDates.length - 1]}`);

    const byDate: Record<string, number> = {};
    scheduledDates.forEach(d => byDate[d] = (byDate[d] || 0) + 1);
    console.log("Posts per day (first 5):", Object.entries(byDate).slice(0, 5));
    console.log("Posts per day (last 5):", Object.entries(byDate).slice(-5));
};

runDebug();
