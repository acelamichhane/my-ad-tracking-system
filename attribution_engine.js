
/**
 * Advanced Attribution Engine
 * Handles complex multi-touch attribution models and customer journey analysis
 */

class AttributionEngine {
    constructor(dbPool) {
        this.db = dbPool;
        this.models = {
            first_click: this.firstClickAttribution,
            last_click: this.lastClickAttribution,
            linear: this.linearAttribution,
            time_decay: this.timeDecayAttribution,
            position_based: this.positionBasedAttribution,
            algorithmic: this.algorithmicAttribution,
            custom: this.customAttribution
        };
    }

    /**
     * Main attribution processing method
     * @param {string} conversionId - The conversion to attribute
     * @param {string} model - Attribution model to use
     * @param {object} options - Additional options
     */
    async processAttribution(conversionId, model = 'last_click', options = {}) {
        try {
            // Get conversion data
            const conversion = await this.getConversionData(conversionId);
            if (!conversion) throw new Error('Conversion not found');

            // Get customer journey touchpoints
            const touchpoints = await this.getCustomerJourney(conversion);
            if (touchpoints.length === 0) {
                throw new Error('No touchpoints found for conversion');
            }

            // Apply attribution model
            const attributionModel = this.models[model];
            if (!attributionModel) {
                throw new Error(`Attribution model '${model}' not found`);
            }

            const attributedTouchpoints = await attributionModel.call(this, touchpoints, conversion, options);

            // Save attribution results
            await this.saveAttributionResults(conversionId, attributedTouchpoints, model);

            // Update campaign performance
            await this.updateCampaignPerformance(attributedTouchpoints, conversion);

            return {
                success: true,
                conversion_id: conversionId,
                model: model,
                touchpoints: attributedTouchpoints.length,
                total_attributed_value: conversion.conversion_value
            };

        } catch (error) {
            console.error('Attribution processing error:', error);
            throw error;
        }
    }

    /**
     * Get conversion data with customer information
     */
    async getConversionData(conversionId) {
        const query = `
            SELECT c.*, cl.user_ip, cl.user_agent, cl.device_type,
                   us.session_id, cl.fb_click_id, cl.browser_id
            FROM conversions c
            LEFT JOIN clicks cl ON c.click_id = cl.click_id
            LEFT JOIN user_sessions us ON cl.click_id = us.last_click_id
            WHERE c.conversion_id = $1
        `;

        const result = await this.db.query(query, [conversionId]);
        return result.rows[0] || null;
    }

    /**
     * Get complete customer journey touchpoints
     */
    async getCustomerJourney(conversion) {
        const lookbackWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
        const conversionTime = new Date(conversion.timestamp).getTime();
        const windowStart = new Date(conversionTime - lookbackWindow);

        // Multiple methods to identify the same user
        const identityQuery = `
            WITH user_identity AS (
                SELECT DISTINCT c.click_id, c.campaign_id, c.ad_id, c.adset_id,
                       c.timestamp, c.utm_source, c.utm_medium, c.utm_campaign,
                       c.user_ip, c.fb_click_id, c.browser_id, c.device_type,
                       us.session_id
                FROM clicks c
                LEFT JOIN user_sessions us ON c.click_id = us.first_click_id OR c.click_id = us.last_click_id
                WHERE c.timestamp >= $1 
                  AND c.timestamp <= $2
                  AND (
                      c.user_ip = $3 OR
                      c.fb_click_id = $4 OR
                      c.browser_id = $5 OR
                      us.session_id = $6
                  )
            )
            SELECT * FROM user_identity
            ORDER BY timestamp ASC
        `;

        const result = await this.db.query(identityQuery, [
            windowStart.toISOString(),
            conversion.timestamp,
            conversion.user_ip,
            conversion.fb_click_id,
            conversion.browser_id,
            conversion.session_id
        ]);

        return result.rows;
    }

    /**
     * First-click attribution model
     */
    async firstClickAttribution(touchpoints) {
        if (touchpoints.length === 0) return [];

        return [{
            ...touchpoints[0],
            attribution_weight: 1.0,
            position: 1,
            total_positions: touchpoints.length
        }];
    }

    /**
     * Last-click attribution model
     */
    async lastClickAttribution(touchpoints) {
        if (touchpoints.length === 0) return [];

        return [{
            ...touchpoints[touchpoints.length - 1],
            attribution_weight: 1.0,
            position: touchpoints.length,
            total_positions: touchpoints.length
        }];
    }

    /**
     * Linear attribution model
     */
    async linearAttribution(touchpoints) {
        if (touchpoints.length === 0) return [];

        const weight = 1.0 / touchpoints.length;

        return touchpoints.map((touchpoint, index) => ({
            ...touchpoint,
            attribution_weight: weight,
            position: index + 1,
            total_positions: touchpoints.length
        }));
    }

    /**
     * Time-decay attribution model
     */
    async timeDecayAttribution(touchpoints, conversion, options = {}) {
        if (touchpoints.length === 0) return [];

        const halfLife = options.halfLife || (7 * 24 * 60 * 60 * 1000); // 7 days default
        const conversionTime = new Date(conversion.timestamp).getTime();

        // Calculate raw weights based on time decay
        const weightedTouchpoints = touchpoints.map((touchpoint, index) => {
            const touchpointTime = new Date(touchpoint.timestamp).getTime();
            const age = conversionTime - touchpointTime;
            const rawWeight = Math.pow(0.5, age / halfLife);

            return {
                ...touchpoint,
                rawWeight: rawWeight,
                age: age,
                position: index + 1,
                total_positions: touchpoints.length
            };
        });

        // Normalize weights to sum to 1.0
        const totalWeight = weightedTouchpoints.reduce((sum, tp) => sum + tp.rawWeight, 0);

        return weightedTouchpoints.map(tp => ({
            ...tp,
            attribution_weight: tp.rawWeight / totalWeight
        }));
    }

    /**
     * Position-based (U-shaped) attribution model
     * 40% first touch, 40% last touch, 20% middle touches
     */
    async positionBasedAttribution(touchpoints) {
        if (touchpoints.length === 0) return [];

        if (touchpoints.length === 1) {
            return [{
                ...touchpoints[0],
                attribution_weight: 1.0,
                position: 1,
                total_positions: 1
            }];
        }

        if (touchpoints.length === 2) {
            return [
                { ...touchpoints[0], attribution_weight: 0.5, position: 1, total_positions: 2 },
                { ...touchpoints[1], attribution_weight: 0.5, position: 2, total_positions: 2 }
            ];
        }

        // U-shaped attribution for 3+ touchpoints
        const middleWeight = 0.2 / (touchpoints.length - 2);

        return touchpoints.map((touchpoint, index) => {
            let weight;
            if (index === 0) {
                weight = 0.4; // First touch gets 40%
            } else if (index === touchpoints.length - 1) {
                weight = 0.4; // Last touch gets 40%
            } else {
                weight = middleWeight; // Middle touches share 20%
            }

            return {
                ...touchpoint,
                attribution_weight: weight,
                position: index + 1,
                total_positions: touchpoints.length
            };
        });
    }

    /**
     * Algorithmic attribution model using machine learning principles
     */
    async algorithmicAttribution(touchpoints, conversion) {
        if (touchpoints.length === 0) return [];

        // Factors that influence attribution weight
        const factors = await Promise.all(touchpoints.map(async (touchpoint, index) => {
            const campaignPerformance = await this.getCampaignPerformance(touchpoint.campaign_id);
            const channelPerformance = await this.getChannelPerformance(touchpoint.utm_source);

            return {
                touchpoint,
                index,
                factors: {
                    // Recency: more recent touches get higher weight
                    recency: this.calculateRecencyScore(touchpoint.timestamp, conversion.timestamp),

                    // Campaign performance: better performing campaigns get higher weight
                    campaign_cvr: campaignPerformance.conversion_rate || 0,
                    campaign_roas: campaignPerformance.roas || 0,

                    // Channel performance
                    channel_cvr: channelPerformance.conversion_rate || 0,

                    // Position: first and last touches get bonus
                    position_bonus: (index === 0 || index === touchpoints.length - 1) ? 0.2 : 0,

                    // Device type: mobile vs desktop performance
                    device_score: this.getDeviceScore(touchpoint.device_type),

                    // Time between touches (frequency)
                    frequency_score: this.calculateFrequencyScore(touchpoints, index)
                }
            };
        }));

        // Calculate composite scores
        const scoredTouchpoints = factors.map(({ touchpoint, index, factors }) => {
            const compositeScore = 
                (factors.recency * 0.3) +
                (factors.campaign_cvr * 0.2) +
                (factors.campaign_roas * 0.15) +
                (factors.channel_cvr * 0.15) +
                (factors.position_bonus * 0.1) +
                (factors.device_score * 0.05) +
                (factors.frequency_score * 0.05);

            return {
                ...touchpoint,
                composite_score: compositeScore,
                factors: factors,
                position: index + 1,
                total_positions: touchpoints.length
            };
        });

        // Normalize scores to weights that sum to 1.0
        const totalScore = scoredTouchpoints.reduce((sum, tp) => sum + tp.composite_score, 0);

        return scoredTouchpoints.map(tp => ({
            ...tp,
            attribution_weight: tp.composite_score / totalScore
        }));
    }

    /**
     * Custom attribution model with user-defined rules
     */
    async customAttribution(touchpoints, conversion, options = {}) {
        const rules = options.rules || [];

        // Default to linear if no rules provided
        if (rules.length === 0) {
            return this.linearAttribution(touchpoints);
        }

        return touchpoints.map((touchpoint, index) => {
            let weight = 0;

            // Apply each rule
            for (const rule of rules) {
                if (this.matchesRule(touchpoint, rule, index, touchpoints.length)) {
                    weight += rule.weight;
                }
            }

            return {
                ...touchpoint,
                attribution_weight: Math.max(weight, 0), // Ensure non-negative
                position: index + 1,
                total_positions: touchpoints.length
            };
        });
    }

    /**
     * Helper methods for algorithmic attribution
     */
    calculateRecencyScore(touchpointTime, conversionTime) {
        const timeDiff = new Date(conversionTime).getTime() - new Date(touchpointTime).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Exponential decay - more recent = higher score
        return Math.exp(-hoursDiff / 168); // 168 hours = 1 week half-life
    }

    getDeviceScore(deviceType) {
        // Placeholder - in production, calculate from historical performance
        return deviceType === 'mobile' ? 0.6 : 0.8;
    }

    calculateFrequencyScore(touchpoints, currentIndex) {
        if (touchpoints.length <= 1) return 0.5;

        // Calculate average time between touches
        let totalGaps = 0;
        let gapCount = 0;

        for (let i = 1; i < touchpoints.length; i++) {
            const gap = new Date(touchpoints[i].timestamp).getTime() - 
                        new Date(touchpoints[i-1].timestamp).getTime();
            totalGaps += gap;
            gapCount++;
        }

        const avgGap = totalGaps / gapCount;
        const optimalGap = 24 * 60 * 60 * 1000; // 24 hours

        // Score based on how close to optimal frequency
        return 1 - Math.abs(avgGap - optimalGap) / optimalGap;
    }

    async getCampaignPerformance(campaignId) {
        const query = `
            SELECT 
                AVG(CASE WHEN clicks > 0 THEN conversions::float / clicks ELSE 0 END) as conversion_rate,
                AVG(CASE WHEN cost > 0 THEN conversion_value / cost ELSE 0 END) as roas
            FROM campaign_performance
            WHERE campaign_id = $1 AND date >= NOW() - INTERVAL '30 days'
        `;

        const result = await this.db.query(query, [campaignId]);
        return result.rows[0] || { conversion_rate: 0, roas: 0 };
    }

    async getChannelPerformance(channel) {
        const query = `
            SELECT 
                COUNT(DISTINCT co.conversion_id)::float / COUNT(DISTINCT c.click_id) as conversion_rate
            FROM clicks c
            LEFT JOIN conversions co ON c.click_id = co.click_id
            WHERE c.utm_source = $1 AND c.timestamp >= NOW() - INTERVAL '30 days'
        `;

        const result = await this.db.query(query, [channel]);
        return result.rows[0] || { conversion_rate: 0 };
    }

    matchesRule(touchpoint, rule, position, totalPositions) {
        // Check various rule conditions
        if (rule.position === 'first' && position !== 0) return false;
        if (rule.position === 'last' && position !== totalPositions - 1) return false;
        if (rule.campaign_id && touchpoint.campaign_id !== rule.campaign_id) return false;
        if (rule.utm_source && touchpoint.utm_source !== rule.utm_source) return false;
        if (rule.device_type && touchpoint.device_type !== rule.device_type) return false;

        return true;
    }

    /**
     * Save attribution results to database
     */
    async saveAttributionResults(conversionId, attributedTouchpoints, model) {
        // Clear existing attribution data
        await this.db.query(
            'DELETE FROM attribution_touchpoints WHERE conversion_id = $1',
            [conversionId]
        );

        // Insert new attribution data
        for (let i = 0; i < attributedTouchpoints.length; i++) {
            const tp = attributedTouchpoints[i];

            await this.db.query(`
                INSERT INTO attribution_touchpoints (
                    conversion_id, click_id, position_in_journey, 
                    attribution_weight, time_to_conversion
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                conversionId,
                tp.click_id,
                tp.position,
                tp.attribution_weight,
                tp.age || 0
            ]);
        }

        // Update conversion record with attribution model
        await this.db.query(
            'UPDATE conversions SET attribution_model = $1 WHERE conversion_id = $2',
            [model, conversionId]
        );
    }

    /**
     * Update campaign performance based on attribution
     */
    async updateCampaignPerformance(attributedTouchpoints, conversion) {
        for (const touchpoint of attributedTouchpoints) {
            if (!touchpoint.campaign_id) continue;

            const attributedValue = conversion.conversion_value * touchpoint.attribution_weight;
            const date = new Date(touchpoint.timestamp).toISOString().split('T')[0];

            await this.db.query(`
                INSERT INTO campaign_performance (campaign_id, date, conversions, conversion_value)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (campaign_id, date) DO UPDATE SET
                    conversions = campaign_performance.conversions + EXCLUDED.conversions,
                    conversion_value = campaign_performance.conversion_value + EXCLUDED.conversion_value,
                    updated_at = NOW()
            `, [
                touchpoint.campaign_id,
                date,
                touchpoint.attribution_weight, // Fractional conversion credit
                attributedValue
            ]);
        }
    }

    /**
     * Batch process multiple conversions
     */
    async batchProcessAttributions(conversionIds, model = 'last_click', options = {}) {
        const results = [];

        for (const conversionId of conversionIds) {
            try {
                const result = await this.processAttribution(conversionId, model, options);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    conversion_id: conversionId,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get attribution analysis for a campaign
     */
    async getAttributionAnalysis(campaignId, startDate, endDate) {
        const query = `
            SELECT 
                c.attribution_model,
                COUNT(DISTINCT c.conversion_id) as conversions,
                SUM(c.conversion_value) as total_value,
                AVG(at.attribution_weight) as avg_weight,
                COUNT(DISTINCT at.click_id) as attributed_touchpoints
            FROM conversions c
            JOIN attribution_touchpoints at ON c.conversion_id = at.conversion_id
            JOIN clicks cl ON at.click_id = cl.click_id
            WHERE cl.campaign_id = $1 
              AND c.timestamp >= $2 
              AND c.timestamp <= $3
            GROUP BY c.attribution_model
            ORDER BY total_value DESC
        `;

        const result = await this.db.query(query, [campaignId, startDate, endDate]);
        return result.rows;
    }
}

module.exports = AttributionEngine;
