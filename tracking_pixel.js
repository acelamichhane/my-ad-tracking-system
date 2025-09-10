
/**
 * Custom Ad Tracking Pixel
 * Handles click tracking, conversion tracking, and data collection
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        API_ENDPOINT: 'https://your-tracking-domain.com/api/track',
        COOKIE_NAME: 'custom_tracker',
        SESSION_COOKIE: 'tracker_session',
        ATTRIBUTION_WINDOW: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        DEBUG: false
    };

    // Utility functions
    const Utils = {
        // Generate unique identifier
        generateId: function() {
            return 'ct_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        },

        // Get URL parameters
        getUrlParams: function() {
            const params = {};
            const urlSearchParams = new URLSearchParams(window.location.search);
            for (const [key, value] of urlSearchParams) {
                params[key] = value;
            }
            return params;
        },

        // Cookie management
        setCookie: function(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
        },

        getCookie: function(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        },

        // Device fingerprinting
        getFingerprint: function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Device fingerprint', 2, 2);

            return {
                screen: screen.width + 'x' + screen.height,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                canvas: canvas.toDataURL(),
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack
            };
        },

        // Send data to server
        sendData: function(endpoint, data, callback) {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint, true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (callback) callback(xhr.status === 200, xhr.responseText);
                }
            };

            xhr.send(JSON.stringify(data));
        },

        // Fallback pixel method
        sendPixel: function(url) {
            const img = new Image(1, 1);
            img.src = url + '&_t=' + Date.now();
            img.style.display = 'none';
            document.body.appendChild(img);
        }
    };

    // Main tracker object
    const CustomTracker = {
        initialized: false,
        clickId: null,
        sessionId: null,

        // Initialize tracker
        init: function() {
            if (this.initialized) return;

            this.sessionId = Utils.getCookie(CONFIG.SESSION_COOKIE) || Utils.generateId();
            Utils.setCookie(CONFIG.SESSION_COOKIE, this.sessionId, 1); // 1 day session

            // Check for click parameters in URL
            const urlParams = Utils.getUrlParams();
            if (urlParams.click_id || urlParams.ctid) {
                this.clickId = urlParams.click_id || urlParams.ctid;
                Utils.setCookie(CONFIG.COOKIE_NAME, this.clickId, 30); // 30 day attribution

                // Track the click
                this.trackClick(urlParams);
            } else {
                // Check if we have a stored click ID
                this.clickId = Utils.getCookie(CONFIG.COOKIE_NAME);
            }

            // Track page view
            this.trackPageView();

            this.initialized = true;

            if (CONFIG.DEBUG) {
                console.log('Custom Tracker initialized', {
                    clickId: this.clickId,
                    sessionId: this.sessionId
                });
            }
        },

        // Track click event
        trackClick: function(params) {
            const clickData = {
                event_type: 'click',
                click_id: this.clickId,
                session_id: this.sessionId,
                timestamp: Date.now(),
                url: window.location.href,
                referrer: document.referrer,
                user_agent: navigator.userAgent,
                device_fingerprint: JSON.stringify(Utils.getFingerprint()),
                utm_source: params.utm_source || '',
                utm_medium: params.utm_medium || '',
                utm_campaign: params.utm_campaign || '',
                utm_content: params.utm_content || '',
                utm_term: params.utm_term || '',
                fb_click_id: params.fbclid || '',
                campaign_id: params.campaign_id || params.cid || '',
                ad_id: params.ad_id || params.aid || '',
                adset_id: params.adset_id || params.gid || ''
            };

            Utils.sendData(CONFIG.API_ENDPOINT + '/click', clickData, function(success, response) {
                if (CONFIG.DEBUG) {
                    console.log('Click tracked:', success ? 'Success' : 'Failed', response);
                }
            });
        },

        // Track page view
        trackPageView: function() {
            const pageData = {
                event_type: 'pageview',
                click_id: this.clickId,
                session_id: this.sessionId,
                timestamp: Date.now(),
                url: window.location.href,
                referrer: document.referrer,
                title: document.title
            };

            Utils.sendData(CONFIG.API_ENDPOINT + '/pageview', pageData);
        },

        // Track conversion event
        trackConversion: function(conversionData) {
            if (!this.clickId) {
                if (CONFIG.DEBUG) console.log('No click ID found for conversion tracking');
                return false;
            }

            const data = {
                event_type: 'conversion',
                click_id: this.clickId,
                session_id: this.sessionId,
                timestamp: Date.now(),
                conversion_type: conversionData.type || 'purchase',
                conversion_value: conversionData.value || 0,
                currency: conversionData.currency || 'USD',
                external_id: conversionData.external_id || '',
                customer_email: conversionData.email || '',
                customer_phone: conversionData.phone || '',
                custom_data: conversionData.custom_data || {}
            };

            Utils.sendData(CONFIG.API_ENDPOINT + '/conversion', data, function(success, response) {
                if (CONFIG.DEBUG) {
                    console.log('Conversion tracked:', success ? 'Success' : 'Failed', response);
                }
            });

            return true;
        },

        // Track custom event
        trackEvent: function(eventName, eventData) {
            const data = {
                event_type: 'custom',
                event_name: eventName,
                click_id: this.clickId,
                session_id: this.sessionId,
                timestamp: Date.now(),
                event_data: eventData || {}
            };

            Utils.sendData(CONFIG.API_ENDPOINT + '/event', data);
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            CustomTracker.init();
        });
    } else {
        CustomTracker.init();
    }

    // Expose tracker to global scope
    window.CustomTracker = CustomTracker;

    // Also create a simpler interface similar to gtag
    window.ct = function(command, ...args) {
        if (command === 'conversion') {
            CustomTracker.trackConversion(args[0] || {});
        } else if (command === 'event') {
            CustomTracker.trackEvent(args[0], args[1]);
        }
    };

})();
