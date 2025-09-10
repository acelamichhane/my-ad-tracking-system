
-- Ad Tracking System Database Schema

-- Core tables for campaign management
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    meta_campaign_id VARCHAR(100),
    daily_budget DECIMAL(10,2),
    total_budget DECIMAL(10,2)
);

-- Track individual clicks
CREATE TABLE clicks (
    id SERIAL PRIMARY KEY,
    click_id VARCHAR(255) UNIQUE NOT NULL,
    campaign_id VARCHAR(100) REFERENCES campaigns(campaign_id),
    ad_id VARCHAR(100),
    adset_id VARCHAR(100),
    user_ip INET,
    user_agent TEXT,
    referrer_url TEXT,
    landing_page TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    fb_click_id VARCHAR(255), -- Facebook click identifier
    browser_id VARCHAR(255),  -- Facebook browser ID
    device_type VARCHAR(50),
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW(),
    INDEX idx_click_id (click_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_fb_click_id (fb_click_id)
);

-- Track conversions
CREATE TABLE conversions (
    id SERIAL PRIMARY KEY,
    conversion_id VARCHAR(255) UNIQUE NOT NULL,
    click_id VARCHAR(255) REFERENCES clicks(click_id),
    campaign_id VARCHAR(100),
    conversion_type VARCHAR(50) NOT NULL, -- 'purchase', 'lead', 'signup', etc.
    conversion_value DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    external_id VARCHAR(255), -- For deduplication
    timestamp TIMESTAMP DEFAULT NOW(),
    attribution_model VARCHAR(50) DEFAULT 'last_click',
    INDEX idx_conversion_id (conversion_id),
    INDEX idx_click_id (click_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_campaign_id (campaign_id)
);

-- Attribution data for complex models
CREATE TABLE attribution_touchpoints (
    id SERIAL PRIMARY KEY,
    conversion_id VARCHAR(255) REFERENCES conversions(conversion_id),
    click_id VARCHAR(255) REFERENCES clicks(click_id),
    position_in_journey INTEGER,
    time_to_conversion INTEGER, -- seconds
    attribution_weight DECIMAL(5,4) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Campaign performance aggregates (updated via triggers)
CREATE TABLE campaign_performance (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100) REFERENCES campaigns(campaign_id),
    date DATE NOT NULL,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_value DECIMAL(10,2) DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

-- Meta API cost data
CREATE TABLE meta_costs (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(100),
    adset_id VARCHAR(100),
    ad_id VARCHAR(100),
    date DATE NOT NULL,
    spend DECIMAL(10,2),
    impressions BIGINT,
    clicks INTEGER,
    reach BIGINT,
    cpm DECIMAL(8,4),
    cpc DECIMAL(8,4),
    ctr DECIMAL(8,6),
    sync_timestamp TIMESTAMP DEFAULT NOW()
);

-- User sessions for better attribution
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    first_click_id VARCHAR(255),
    last_click_id VARCHAR(255),
    session_start TIMESTAMP,
    session_end TIMESTAMP,
    total_pageviews INTEGER DEFAULT 1,
    device_fingerprint VARCHAR(255),
    INDEX idx_session_id (session_id)
);

-- Tracking domains and settings
CREATE TABLE tracking_domains (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    ssl_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- API tokens and configurations
CREATE TABLE api_configurations (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL, -- 'meta', 'google', etc.
    access_token TEXT,
    refresh_token TEXT,
    pixel_id VARCHAR(100),
    account_id VARCHAR(100),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
