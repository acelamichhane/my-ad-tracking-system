
/**
 * Custom Ad Tracking System Backend
 * Handles API endpoints for tracking, attribution, and reporting
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ad_tracking',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const trackingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many tracking requests'
});

// Utility functions
const Utils = {
    generateId: () => {
        return crypto.randomBytes(16).toString('hex');
    },

    hashEmail: (email) => {
        return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
    },

    getClientIP: (req) => {
        return req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    },

    parseUserAgent: (userAgent) => {
        // Simple user agent parsing - in production use a library like 'ua-parser-js'
        const mobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
        const browser = userAgent.includes('Chrome') ? 'Chrome' : 
                       userAgent.includes('Firefox') ? 'Firefox' : 
                       userAgent.includes('Safari') ? 'Safari' : 'Unknown';

        return {
            isMobile: mobile,
            browser: browser,
            full: userAgent
        };
    }
};

// Attribution Models
const AttributionModels = {
    lastClick: (touchpoints) => {
        if (touchpoints.length === 0) return [];
        return [{ ...touchpoints[touchpoints.length - 1], weight: 1.0 }];
    },

    firstClick: (touchpoints) => {
        if (touchpoints.length === 0) return [];
        return [{ ...touchpoints[0], weight: 1.0 }];
    },

    linear: (touchpoints) => {
        if (touchpoints.length === 0) return [];
        const weight = 1.0 / touchpoints.length;
        return touchpoints.map(tp => ({ ...tp, weight }));
    },

    timeDecay: (touchpoints) => {
        if (touchpoints.length === 0) return [];
        const now = Date.now();
        const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days

        let totalWeight = 0;
        const weightedTouchpoints = touchpoints.map(tp => {
            const age = now - new Date(tp.timestamp).getTime();
            const weight = Math.pow(0.5, age / halfLife);
            totalWeight += weight;
            return { ...tp, rawWeight: weight };
        });

        // Normalize weights
        return weightedTouchpoints.map(tp => ({
            ...tp,
            weight: tp.rawWeight / totalWeight
        }));
    }
};

// API Endpoints

// Track click events
app.post('/api/track/click', trackingLimiter, async (req, res) => {
    try {
        const {
            click_id,
            session_id,
            campaign_id,
            ad_id,
            adset_id,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
            fb_click_id
        } = req.body;

        const clientIP = Utils.getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';
        const deviceInfo = Utils.parseUserAgent(userAgent);

        // Insert click record
        const query = `
            INSERT INTO clicks (
                click_id, campaign_id, ad_id, adset_id, user_ip, user_agent,
                referrer_url, landing_page, utm_source, utm_medium, utm_campaign,
                utm_content, utm_term, fb_click_id, device_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (click_id) DO UPDATE SET
                timestamp = NOW()
        `;

        const values = [
            click_id, campaign_id, ad_id, adset_id, clientIP, userAgent,
            req.body.referrer || '', req.body.url || '', utm_source, utm_medium,
            utm_campaign, utm_content, utm_term, fb_click_id, 
            deviceInfo.isMobile ? 'mobile' : 'desktop'
        ];

        await pool.query(query, values);

        // Update session data
        if (session_id) {
            const sessionQuery = `
                INSERT INTO user_sessions (session_id, first_click_id, last_click_id, session_start, session_end)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (session_id) DO UPDATE SET
                    last_click_id = $3,
                    session_end = NOW(),
                    total_pageviews = user_sessions.total_pageviews + 1
            `;
            await pool.query(sessionQuery, [session_id, click_id, click_id]);
        }

        res.json({ success: true, click_id });
    } catch (error) {
        console.error('Error tracking click:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track conversions
app.post('/api/track/conversion', trackingLimiter, async (req, res) => {
    try {
        const {
            click_id,
            conversion_type,
            conversion_value,
            currency,
            customer_email,
            customer_phone,
            external_id,
            attribution_model = 'last_click'
        } = req.body;

        if (!click_id) {
            return res.status(400).json({ success: false, error: 'Click ID required' });
        }

        const conversion_id = Utils.generateId();

        // Get the click data
        const clickQuery = 'SELECT * FROM clicks WHERE click_id = $1';
        const clickResult = await pool.query(clickQuery, [click_id]);

        if (clickResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Click not found' });
        }

        const clickData = clickResult.rows[0];

        // Insert conversion
        const conversionQuery = `
            INSERT INTO conversions (
                conversion_id, click_id, campaign_id, conversion_type,
                conversion_value, currency, customer_email, customer_phone,
                external_id, attribution_model
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        await pool.query(conversionQuery, [
            conversion_id, click_id, clickData.campaign_id, conversion_type,
            conversion_value || 0, currency || 'USD',
            customer_email ? Utils.hashEmail(customer_email) : null,
            customer_phone, external_id, attribution_model
        ]);

        // Handle multi-touch attribution if needed
        if (attribution_model !== 'last_click') {
            await handleMultiTouchAttribution(conversion_id, click_id, attribution_model);
        }

        // Send to Meta Conversions API
        await sendToMetaAPI({
            event_name: conversion_type,
            event_time: Math.floor(Date.now() / 1000),
            user_data: {
                em: customer_email ? [Utils.hashEmail(customer_email)] : undefined,
                ph: customer_phone ? [customer_phone] : undefined,
                client_ip_address: clickData.user_ip,
                client_user_agent: clickData.user_agent,
                fbc: clickData.fb_click_id ? `fb.1.${Date.now()}.${clickData.fb_click_id}` : undefined
            },
            custom_data: {
                value: conversion_value || 0,
                currency: currency || 'USD'
            }
        });

        res.json({ success: true, conversion_id });
    } catch (error) {
        console.error('Error tracking conversion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Handle multi-touch attribution
async function handleMultiTouchAttribution(conversion_id, final_click_id, model) {
    try {
        // Get the session data to find all touchpoints
        const sessionQuery = `
            SELECT c.* FROM clicks c
            JOIN user_sessions s ON (s.first_click_id = c.click_id OR s.last_click_id = c.click_id)
            WHERE s.session_id IN (
                SELECT us.session_id FROM user_sessions us
                JOIN clicks cl ON (us.first_click_id = cl.click_id OR us.last_click_id = cl.click_id)
                WHERE cl.click_id = $1
            )
            ORDER BY c.timestamp ASC
        `;

        const touchpoints = await pool.query(sessionQuery, [final_click_id]);
        const attributedTouchpoints = AttributionModels[model] ? 
            AttributionModels[model](touchpoints.rows) : 
            AttributionModels.lastClick(touchpoints.rows);

        // Insert attribution data
        for (let i = 0; i < attributedTouchpoints.length; i++) {
            const tp = attributedTouchpoints[i];
            await pool.query(`
                INSERT INTO attribution_touchpoints 
                (conversion_id, click_id, position_in_journey, attribution_weight)
                VALUES ($1, $2, $3, $4)
            `, [conversion_id, tp.click_id, i + 1, tp.weight]);
        }
    } catch (error) {
        console.error('Error handling multi-touch attribution:', error);
    }
}

// Send data to Meta Conversions API
async function sendToMetaAPI(eventData) {
    try {
        const config = await getMetaAPIConfig();
        if (!config || !config.pixel_id || !config.access_token) {
            console.log('Meta API not configured, skipping CAPI send');
            return;
        }

        const payload = {
            data: [eventData],
            test_event_code: process.env.META_TEST_CODE || undefined
        };

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${config.pixel_id}/events`,
            payload,
            {
                params: { access_token: config.access_token },
                headers: { 'Content-Type': 'application/json' }
            }
        );

        console.log('Meta CAPI response:', response.data);
    } catch (error) {
        console.error('Error sending to Meta API:', error.response?.data || error.message);
    }
}

// Get Meta API configuration
async function getMetaAPIConfig() {
    try {
        const result = await pool.query(
            "SELECT * FROM api_configurations WHERE provider = 'meta' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1"
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting Meta API config:', error);
        return null;
    }
}

// Campaign performance report
app.get('/api/reports/campaigns', async (req, res) => {
    try {
        const { start_date, end_date, campaign_id } = req.query;

        let query = `
            SELECT 
                c.campaign_id,
                c.name,
                COUNT(DISTINCT cl.click_id) as clicks,
                COUNT(DISTINCT co.conversion_id) as conversions,
                SUM(co.conversion_value) as revenue,
                COALESCE(SUM(mc.spend), 0) as cost,
                CASE WHEN COUNT(DISTINCT cl.click_id) > 0 
                     THEN COUNT(DISTINCT co.conversion_id)::float / COUNT(DISTINCT cl.click_id) * 100
                     ELSE 0 END as conversion_rate,
                CASE WHEN SUM(mc.spend) > 0 
                     THEN SUM(co.conversion_value) / SUM(mc.spend)
                     ELSE 0 END as roas
            FROM campaigns c
            LEFT JOIN clicks cl ON c.campaign_id = cl.campaign_id
            LEFT JOIN conversions co ON cl.click_id = co.click_id
            LEFT JOIN meta_costs mc ON c.campaign_id = mc.campaign_id
            WHERE 1=1
        `;

        const params = [];
        if (start_date) {
            query += ` AND cl.timestamp >= $${params.length + 1}`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND cl.timestamp <= $${params.length + 1}`;
            params.push(end_date);
        }
        if (campaign_id) {
            query += ` AND c.campaign_id = $${params.length + 1}`;
            params.push(campaign_id);
        }

        query += ' GROUP BY c.campaign_id, c.name ORDER BY revenue DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error getting campaign reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Meta API cost sync
app.post('/api/sync/meta-costs', async (req, res) => {
    try {
        const config = await getMetaAPIConfig();
        if (!config) {
            return res.status(400).json({ success: false, error: 'Meta API not configured' });
        }

        const campaigns = await pool.query('SELECT campaign_id, meta_campaign_id FROM campaigns WHERE meta_campaign_id IS NOT NULL');

        for (const campaign of campaigns.rows) {
            try {
                const insights = await axios.get(
                    `https://graph.facebook.com/v18.0/${campaign.meta_campaign_id}/insights`,
                    {
                        params: {
                            access_token: config.access_token,
                            fields: 'spend,impressions,clicks,reach,cpm,cpc,ctr',
                            date_preset: 'yesterday'
                        }
                    }
                );

                if (insights.data.data && insights.data.data.length > 0) {
                    const data = insights.data.data[0];
                    await pool.query(`
                        INSERT INTO meta_costs (campaign_id, date, spend, impressions, clicks, reach, cpm, cpc, ctr)
                        VALUES ($1, CURRENT_DATE - INTERVAL '1 day', $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (campaign_id, date) DO UPDATE SET
                            spend = EXCLUDED.spend,
                            impressions = EXCLUDED.impressions,
                            clicks = EXCLUDED.clicks,
                            reach = EXCLUDED.reach,
                            cpm = EXCLUDED.cpm,
                            cpc = EXCLUDED.cpc,
                            ctr = EXCLUDED.ctr
                    `, [
                        campaign.campaign_id,
                        parseFloat(data.spend || 0),
                        parseInt(data.impressions || 0),
                        parseInt(data.clicks || 0),
                        parseInt(data.reach || 0),
                        parseFloat(data.cpm || 0),
                        parseFloat(data.cpc || 0),
                        parseFloat(data.ctr || 0)
                    ]);
                }
            } catch (error) {
                console.error(`Error syncing campaign ${campaign.campaign_id}:`, error.response?.data || error.message);
            }
        }

        res.json({ success: true, message: 'Cost sync completed' });
    } catch (error) {
        console.error('Error syncing Meta costs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Ad Tracking Server running on port ${PORT}`);
});

module.exports = app;
