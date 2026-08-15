# Linux & AWS Lightsail Deployment Guide

This folder (`deploy_linux`) contains the standalone, complete, and pre-configured deployment package for hosting the **Classroom Board Scanner Application** on **AWS Lightsail** (or any Ubuntu / Debian Linux VPS).

---

## Folder Structure

```
deploy_linux/
├── backend/                  # Node.js + Express + Prisma REST API
├── demo/                     # Web Simulator Dashboard (Port 3000)
├── ecosystem.config.js       # PM2 Production Process Manager configuration
├── setup_linux.sh            # 1-Click Automated Setup Bash Script
├── docker-compose.yml        # Docker Multi-Container setup (Alternative)
├── nginx.conf.example        # Nginx Reverse Proxy Template
└── README_LINUX_DEPLOY.md    # Deployment Instructions
```

---

## Option 1: 1-Click Installation (Recommended for AWS Lightsail)

### Step 1: Upload `deploy_linux` to your AWS Lightsail Instance
You can upload the `deploy_linux` folder using SCP or Git:

```bash
# Using SCP from your local machine:
scp -r d:/tg-app/deploy_linux ubuntu@<YOUR_LIGHTSAIL_STATIC_IP>:/home/ubuntu/board-scanner
```

### Step 2: Connect to your Instance via SSH and Run Setup
```bash
# Connect to your instance
ssh ubuntu@<YOUR_LIGHTSAIL_STATIC_IP>

# Navigate to the folder
cd /home/ubuntu/board-scanner

# Make the setup script executable and run it
chmod +x setup_linux.sh
./setup_linux.sh
```

### What `setup_linux.sh` does automatically:
1. Installs Node.js 20, npm, Git, Nginx, PostgreSQL, and PM2.
2. Creates and configures the local PostgreSQL database (`board_scanner_db`).
3. Installs backend dependencies, generates Prisma ORM client models, and compiles TypeScript.
4. Starts both the API Server (Port 5000) and Web Simulator (Port 3000) under PM2 daemon management.
5. Saves PM2 startup rules so your app automatically restarts after server reboots.

---

## Option 2: Docker Compose Installation (Alternative)

If you prefer running everything in isolated Docker containers:

```bash
# 1. Install Docker & Docker Compose on Ubuntu:
sudo apt update
sudo apt install docker.io docker-compose -y

# 2. Start the entire application stack:
cd /home/ubuntu/board-scanner
sudo docker-compose up -d --build
```

---

## Step 3: Configure AWS Lightsail Firewall Rules

In your **AWS Lightsail Console**:
1. Click on your Instance -> **Networking** tab.
2. Under **IPv4 Firewall**, click **Add Rule**:
   * **HTTP** (Port `80`) -> Allow
   * **HTTPS** (Port `443`) -> Allow
   * **Custom TCP** (Port `5000` - API Server) -> Allow
   * **Custom TCP** (Port `3000` - Web Simulator) -> Allow

---

## Step 4: Configure Nginx & SSL Certification (Optional for Custom Domains)

1. Copy Nginx configuration:
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/board-scanner
   sudo ln -s /etc/nginx/sites-available/board-scanner /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```
2. Enable Free HTTPS / SSL with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx
   ```

---

## Verification & Management Commands

* Check running processes: `pm2 status`
* View live application logs: `pm2 logs`
* Restart servers: `pm2 restart all`
* Access Web Simulator: `http://<YOUR_STATIC_IP>:3000`
* Access REST API: `http://<YOUR_STATIC_IP>:5000/api/sim/data`
