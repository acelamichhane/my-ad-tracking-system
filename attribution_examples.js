
// Example: Using the Attribution Engine

const AttributionEngine = require('./attribution_engine');
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ad_tracking',
    password: 'password',
    port: 5432,
});

// Initialize attribution engine
const attributionEngine = new AttributionEngine(pool);

// Example 1: Process single conversion with last-click attribution
async function processLastClickAttribution() {
    try {
        const result = await attributionEngine.processAttribution(
            'conv_12345',
            'last_click'
        );
        console.log('Attribution result:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 2: Process with algorithmic attribution
async function processAlgorithmicAttribution() {
    try {
        const result = await attributionEngine.processAttribution(
            'conv_12345',
            'algorithmic'
        );
        console.log('Algorithmic attribution:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 3: Custom attribution with rules
async function processCustomAttribution() {
    const customRules = [
        {
            position: 'first',
            weight: 0.4
        },
        {
            position: 'last', 
            weight: 0.4
        },
        {
            utm_source: 'facebook',
            weight: 0.3
        },
        {
            device_type: 'mobile',
            weight: 0.1
        }
    ];

    try {
        const result = await attributionEngine.processAttribution(
            'conv_12345',
            'custom',
            { rules: customRules }
        );
        console.log('Custom attribution:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 4: Batch process multiple conversions
async function batchProcessAttributions() {
    const conversionIds = ['conv_001', 'conv_002', 'conv_003'];

    try {
        const results = await attributionEngine.batchProcessAttributions(
            conversionIds,
            'time_decay',
            { halfLife: 5 * 24 * 60 * 60 * 1000 } // 5 days
        );
        console.log('Batch results:', results);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Example 5: Get attribution analysis for campaign
async function getCampaignAttributionAnalysis() {
    const startDate = '2025-08-01';
    const endDate = '2025-08-31';

    try {
        const analysis = await attributionEngine.getAttributionAnalysis(
            'camp_summer_sale',
            startDate,
            endDate
        );
        console.log('Attribution analysis:', analysis);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run examples
processLastClickAttribution();
processAlgorithmicAttribution();
processCustomAttribution();
batchProcessAttributions();
getCampaignAttributionAnalysis();
