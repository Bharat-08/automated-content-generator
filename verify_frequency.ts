import { calculatePlatformFrequency, type FrequencyInput } from './src/utils/platformFrequency';

const testScenarios: FrequencyInput[] = [
    {
        activePlatforms: ['Instagram', 'LinkedIn'],
        primaryGoal: 'Leads/Sales',
        timeframeWeeks: 4,
    },
    {
        activePlatforms: ['YouTube', 'LinkedIn'],
        primaryGoal: 'Thought Leadership',
        timeframeWeeks: 2,
    },
    {
        activePlatforms: ['Instagram', 'LinkedIn', 'YouTube'],
        primaryGoal: 'Engagement/Awareness',
        timeframeWeeks: 1,
    },
];

console.log('--- Platform Frequency Logic Verification ---');

testScenarios.forEach((scenario, index) => {
    console.log(`\nScenario ${index + 1}:`);
    console.log(`Platforms: ${scenario.activePlatforms.join(', ')}`);
    console.log(`Goal: ${scenario.primaryGoal}`);
    console.log(`Timeframe: ${scenario.timeframeWeeks} week(s)`);

    const results = calculatePlatformFrequency(scenario);

    results.forEach((res) => {
        console.log(`- ${res.platform}: ${res.weeklyFrequency} posts/week, Total: ${res.totalPostCount}`);
    });
});
