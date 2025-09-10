#!/bin/bash

# Ad Tracking System Installation Script
# Run with: bash install.sh

set -e

echo "🚀 Installing Ad Tracking System..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Install Nginx
echo "📦 Installing Nginx..."
apt-get install -y nginx

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Create application user
echo "👤 Creating application user..."
useradd -r -s /bin/false -d /opt/ad-tracking-system nodejs || true

# Create application directory
echo "📁 Setting up application directory..."
mkdir -p /opt/ad-tracking-system
mkdir -p /opt/ad-tracking-system/logs
chown -R nodejs:nodejs /opt/ad-tracking-system

# Copy application files
echo "📄 Copying application files..."
cp -r ./* /opt/ad-tracking-system/
cd /opt/ad-tracking-system

# Install dependencies
echo "📦 Installing application dependencies..."
npm ci --production

# Set up environment file
echo "⚙️ Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✏️  Please edit /opt/ad-tracking-system/.env with your configuration"
fi

# Set up PostgreSQL database
echo "🗄️ Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE ad_tracking;" || true
sudo -u postgres psql -c "CREATE USER adtracker WITH PASSWORD 'changeme123';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ad_tracking TO adtracker;" || true
sudo -u postgres psql -d ad_tracking -f tracking_system_schema.sql

# Set up systemd service
echo "⚙️ Setting up systemd service..."
cp ad-tracking.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ad-tracking

# Set up Nginx
echo "🌐 Configuring Nginx..."
cp nginx.conf /etc/nginx/sites-available/ad-tracking
ln -sf /etc/nginx/sites-available/ad-tracking /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Set up SSL (placeholder - user needs to add their certificates)
echo "🔒 SSL Setup Required:"
echo "   1. Add your SSL certificates to /etc/nginx/ssl/"
echo "   2. Update server_name in nginx.conf"
echo "   3. Restart nginx: systemctl restart nginx"

# Final permissions
chown -R nodejs:nodejs /opt/ad-tracking-system

echo ""
echo "✅ Installation completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit /opt/ad-tracking-system/.env with your configuration"
echo "   2. Add your SSL certificates"
echo "   3. Start the service: systemctl start ad-tracking"
echo "   4. Check status: systemctl status ad-tracking"
echo ""
echo "🌐 Your tracking domain will be available at: https://track.yourdomain.com"
echo "📊 Dashboard will be available at: https://dashboard.yourdomain.com"
