# Volume Fashion Collection - Deployment Guide

## Table of Contents
1. [Export from Replit](#export-from-replit)
2. [Server Requirements](#server-requirements)
3. [Database Setup](#database-setup)
4. [Application Installation](#application-installation)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [Using a Process Manager](#using-a-process-manager)
8. [Setting up Nginx Reverse Proxy](#setting-up-nginx-reverse-proxy)
9. [SSL Certificate Setup](#ssl-certificate-setup)
10. [Troubleshooting](#troubleshooting)

---

## Export from Replit

### Method 1: Download as ZIP (Easiest)
1. Click on the **three dots menu (⋮)** at the top left of your Replit workspace
2. Select **"Download as zip"**
3. Your entire project will be downloaded as a ZIP file
4. Extract the ZIP file on your local computer

### Method 2: Using Git (Recommended)
```bash
# In Replit Shell
git init
git add .
git commit -m "Export project"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

---

## Server Requirements

### Minimum Specifications
- **OS**: Ubuntu 20.04 LTS or newer (Debian-based recommended)
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 20GB minimum
- **CPU**: 1 core minimum (2 cores recommended)

### Required Software
- Node.js 20.x or higher
- PostgreSQL 14 or higher
- Nginx (for reverse proxy)
- PM2 (process manager)

---

## Database Setup

### 1. Install PostgreSQL
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell, run:
CREATE DATABASE fashion_inventory;
CREATE USER fashion_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fashion_inventory TO fashion_user;

# Exit PostgreSQL shell
\q
```

### 3. Configure PostgreSQL for Remote Access (if needed)
```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and modify:
listen_addresses = '*'

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add this line:
host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## Application Installation

### 1. Install Node.js
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Upload and Extract Application
```bash
# Create application directory
sudo mkdir -p /var/www/fashion-app
cd /var/www/fashion-app

# Upload your ZIP file (using scp, SFTP, or any method)
# Then extract:
unzip fashion-app.zip

# Or clone from Git:
git clone YOUR_GITHUB_REPO_URL .
```

### 3. Install Dependencies
```bash
cd /var/www/fashion-app
npm install --production
```

### 4. Build the Application
```bash
npm run build
```

---

## Environment Configuration

### 1. Create Environment File
```bash
cd /var/www/fashion-app
nano .env
```

### 2. Add Environment Variables
```bash
# Database Configuration
DATABASE_URL=postgresql://fashion_user:your_secure_password@localhost:5432/fashion_inventory
PGHOST=localhost
PGPORT=5432
PGUSER=fashion_user
PGPASSWORD=your_secure_password
PGDATABASE=fashion_inventory

# Application Configuration
NODE_ENV=production
PORT=5000
SESSION_SECRET=your_very_long_random_secret_string_here

# Email Configuration (for password reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Twilio Configuration (for WhatsApp)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# Object Storage (if using Google Cloud Storage)
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your_bucket_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### 3. Generate Secure Session Secret
```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Set Proper Permissions
```bash
sudo chown -R $USER:$USER /var/www/fashion-app
chmod 600 .env
```

---

## Running the Application

### Test Run (Development Mode)
```bash
cd /var/www/fashion-app
npm run dev
```

### Production Run
```bash
npm start
```

Test by accessing: `http://your_server_ip:5000`

---

## Using a Process Manager

### 1. Install PM2
```bash
sudo npm install -g pm2
```

### 2. Start Application with PM2
```bash
cd /var/www/fashion-app

# Start the application
pm2 start npm --name "fashion-app" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

### 3. Useful PM2 Commands
```bash
# View application status
pm2 status

# View logs
pm2 logs fashion-app

# Restart application
pm2 restart fashion-app

# Stop application
pm2 stop fashion-app

# Monitor resources
pm2 monit
```

---

## Setting up Nginx Reverse Proxy

### 1. Install Nginx
```bash
sudo apt install nginx -y
```

### 2. Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/fashion-app
```

### 3. Add Configuration
```nginx
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    client_max_body_size 50M;
}
```

### 4. Enable Site
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/fashion-app /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## SSL Certificate Setup

### Using Let's Encrypt (Free SSL)

### 1. Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Obtain Certificate
```bash
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

### 3. Auto-renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot will automatically renew certificates
```

---

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs fashion-app

# Check if port is in use
sudo netstat -tulpn | grep 5000

# Restart application
pm2 restart fashion-app
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
psql -U fashion_user -d fashion_inventory -h localhost

# Check DATABASE_URL in .env file
cat .env | grep DATABASE_URL
```

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/fashion-app

# Fix permissions
chmod -R 755 /var/www/fashion-app
chmod 600 /var/www/fashion-app/.env
```

### High Memory Usage
```bash
# Check resource usage
pm2 monit

# Restart with limited memory
pm2 restart fashion-app --max-memory-restart 500M
```

---

## Post-Deployment Checklist

- [ ] Database is created and accessible
- [ ] All environment variables are set correctly
- [ ] Application starts without errors
- [ ] Can access application via IP address
- [ ] Nginx reverse proxy is configured
- [ ] SSL certificate is installed (for HTTPS)
- [ ] PM2 is configured for auto-restart
- [ ] Firewall allows ports 80 and 443
- [ ] Database backups are configured
- [ ] Admin user can log in successfully

---

## Default Login Credentials

**Username:** abd.rabo.940@gmail.com  
**Password:** New@2025

**⚠️ Important:** Change these credentials immediately after first login!

---

## Support & Maintenance

### Regular Maintenance Tasks
1. **Update dependencies** monthly
2. **Backup database** daily
3. **Monitor logs** for errors
4. **Check disk space** weekly
5. **Update SSL certificates** (auto-renewed by Certbot)

### Backup Database
```bash
# Create backup
pg_dump -U fashion_user fashion_inventory > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U fashion_user fashion_inventory < backup_20240101.sql
```

---

## Contact Information

**Application:** Volume Fashion Collection  
**Version:** 1.0.0  
**Database:** PostgreSQL  
**Platform:** Node.js + Express + React

For technical support, refer to the application documentation or contact your system administrator.
