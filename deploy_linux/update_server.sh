#!/usr/bin/env bash
# update_server.sh
# 1-Click Server Update & PM2 Restart Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Board Scanner Linux Server Update & PM2 Restarter ${NC}"
echo -e "${GREEN}====================================================${NC}"

# 1. Navigate to root git repo
cd "$(dirname "$0")/.."

# 2. Fetch and pull latest main branch from GitHub
echo -e "${YELLOW}[*] Syncing latest code from GitHub...${NC}"
git fetch origin main
git reset --hard origin/main

# 3. Backend Setup
echo -e "${YELLOW}[*] Updating backend dependencies & Prisma Client...${NC}"
cd deploy_linux/backend
if [ ! -f .env ]; then
  cp .env.example .env
fi

npm install
npx prisma generate

# 4. Restart PM2 Daemon
echo -e "${YELLOW}[*] Restarting PM2 cluster daemon...${NC}"
cd ..
pm2 delete all || true
pm2 start ecosystem.config.js
pm2 save

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  Server Update Complete!                           ${NC}"
echo -e "${GREEN}  Backend REST API is online on Port 5000          ${NC}"
echo -e "${GREEN}====================================================${NC}"
