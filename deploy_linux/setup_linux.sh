#!/usr/bin/env bash

# setup_linux.sh
# Automated 1-Click Installation Script for Ubuntu / Debian AWS Lightsail Servers

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Board Scanner Linux / AWS Lightsail Deployer      ${NC}"
echo -e "${GREEN}====================================================${NC}"

# 1. Update system packages
echo -e "${YELLOW}[*] Updating Ubuntu package repositories...${NC}"
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS & Build Tools
echo -e "${YELLOW}[*] Installing Node.js 20 LTS & Build utilities...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git curl build-essential nginx postgresql postgresql-contrib

# 3. Install PM2 Globally
echo -e "${YELLOW}[*] Installing PM2 process manager...${NC}"
sudo npm install -g pm2

# 4. Configure Local PostgreSQL Database
echo -e "${YELLOW}[*] Configuring PostgreSQL database user & database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE board_scanner_db;" || true
sudo -u postgres psql -c "CREATE USER postgres_user WITH PASSWORD 'password123!';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE board_scanner_db TO postgres_user;" || true

# 5. Build Backend API Server
echo -e "${YELLOW}[*] Installing Backend dependencies & building TypeScript code...${NC}"
cd "$(dirname "$0")/backend"

if [ ! -f .env ]; then
  echo "[*] Creating .env file from .env.example..."
  cp .env.example .env
fi

npm install
npx prisma generate
npm run build

# 6. Build Web Simulator Demo Server
echo -e "${YELLOW}[*] Installing Web Simulator dependencies...${NC}"
cd "../demo"
npm install

# 7. Start PM2 Processes
echo -e "${YELLOW}[*] Starting PM2 process daemon...${NC}"
cd ".."
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Deployment Complete!                              ${NC}"
echo -e "${GREEN}  - Web Simulator running on Port 3000              ${NC}"
echo -e "${GREEN}  - Backend REST API running on Port 5000           ${NC}"
echo -e "${GREEN}====================================================${NC}"
