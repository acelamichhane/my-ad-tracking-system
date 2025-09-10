# Custom Meta Ads Tracking System

A complete, self-hosted Meta ads tracking and attribution platform that provides accurate campaign performance data without relying on third-party services.

## 🚀 Features

- **Pixel-Perfect Tracking**: Custom JavaScript pixel for accurate click and conversion tracking
- **Multi-Touch Attribution**: Support for first-click, last-click, linear, and time-decay attribution models
- **Meta API Integration**: Direct integration with Meta Marketing API and Conversions API
- **Real-Time Dashboard**: React-based dashboard for campaign management and reporting
- **Privacy Compliant**: GDPR and CCPA compliant data collection and processing
- **High Performance**: Optimized database queries and caching for high-traffic campaigns
- **Docker Ready**: Full containerization support for easy deployment

## 📋 System Requirements

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+ (optional but recommended)
- Nginx (for production)
- SSL certificate for tracking domain

## 🛠 Quick Start

### Using Docker Compose (Recommended)

1. **Clone and configure**:
   ```bash
   git clone https://github.com/yourusername/ad-tracking-system
   cd ad-tracking-system
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Initialize database**:
   ```bash
   docker-compose exec db psql -U postgres -d ad_tracking -f /docker-entrypoint-initdb.d/01-schema.sql
   ```

### Manual Installation

1. **Run installation script**:
   ```bash
   sudo bash install.sh
   ```

2. **Configure environment**:
   ```bash
   sudo nano /opt/ad-tracking-system/.env
   ```

3. **Start service**:
   ```bash
   sudo systemctl start ad-tracking
   sudo systemctl enable ad-tracking
   ```

## ⚙️ Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Database
DB_HOST=localhost
DB_NAME=ad_tracking
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Meta API
META_APP_ID=your_meta_app_id
META_PIXEL_ID=your_facebook_pixel_id
META_ACCESS_TOKEN=your_long_lived_access_token

# Tracking
TRACKING_DOMAIN=https://track.yourdomain.com
```

### Meta API Setup

1. **Create Meta App**:
   - Go to [Meta for Developers](https://developers.facebook.com)
   - Create new app and add Marketing API
   - Generate long-lived access token

2. **Configure Permissions**:
   - `ads_read`: Read campaign data
   - `ads_management`: Manage campaigns (optional)
   - `business_management`: Access business accounts

## 📊 Usage

### Installing Tracking Pixel

Add this snippet to your website's `<head>` section:

```html
<!-- Custom Ad Tracking Pixel -->
<script>
(function(){
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://track.yourdomain.com/pixel.js?v=' + Math.floor(Date.now()/86400000);
    var first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(script, first);

    window.ct = window.ct || function() {
        (window.ct.q = window.ct.q || []).push(arguments);
    };
})();
</script>
```

### Tracking Conversions

Track conversion events with JavaScript:

```javascript
// Track a purchase
ct('conversion', {
    type: 'purchase',
    value: 99.99,
    currency: 'USD',
    email: 'customer@example.com'
});

// Track a lead
ct('conversion', {
    type: 'lead',
    email: 'lead@example.com'
});
```

### Campaign URLs

Create tracking URLs for your Meta ads:

```
https://yourdomain.com?campaign_id=summer_sale&utm_source=facebook&utm_medium=cpc&utm_campaign=summer_sale_2025
```

## 🔧 API Endpoints

### Tracking API

- `POST /api/track/click` - Record click events
- `POST /api/track/conversion` - Record conversions
- `POST /api/track/pageview` - Record page views

### Reporting API

- `GET /api/reports/campaigns` - Campaign performance data
- `GET /api/reports/attribution` - Attribution analysis
- `POST /api/sync/meta-costs` - Sync Meta API costs

## 📈 Dashboard

Access your dashboard at `https://dashboard.yourdomain.com` to:

- View campaign performance metrics
- Analyze conversion attribution
- Monitor real-time tracking data
- Export performance reports
- Manage tracking configurations

## 🔒 Security

- Rate limiting on all API endpoints
- CORS protection
- SQL injection prevention
- Secure cookie handling
- SSL/TLS encryption required
- Optional: IP whitelisting for admin access

## 🚀 Performance

- Optimized database indexes for fast queries
- Redis caching layer for frequently accessed data
- Nginx reverse proxy with gzip compression
- Connection pooling for database connections
- Horizontal scaling support

## 📊 Monitoring

Includes optional monitoring setup:

- Prometheus metrics collection
- Grafana dashboard templates
- Health check endpoints
- Application logging
- Error tracking integration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- Create an issue for bug reports
- Join our Discord for community support
- Check the wiki for detailed guides
- Email support@yourdomain.com for priority support

## 🔄 Updates

- Check releases for updates
- Subscribe to notifications for security updates
- Follow our changelog for new features

---

Built with ❤️ for accurate Meta ads tracking and attribution.
