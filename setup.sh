#!/bin/bash
set -e

# ── RemoteIT Auto Setup Script ──
# Run with: sudo bash setup.sh

DOMAIN="remoteit.numbers10.co.za"
APP_DIR="/var/www/remoteit"
PORT=3000

echo "============================================"
echo "  RemoteIT — Automated Server Setup"
echo "============================================"
echo ""

# ── 1. System dependencies ──
echo "[1/8] Installing system dependencies..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "  Node.js already installed: $(node -v)"
fi

apt install -y nginx certbot python3-certbot-nginx -qq

npm install -g tsx pm2 2>&1 | tail -1

echo "  Node: $(node -v) | npm: $(npm -v)"
echo "  nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"

# ── 2. App setup ──
echo ""
echo "[2/8] Installing npm packages..."
cd "$APP_DIR"
npm install 2>&1 | tail -1

# ── 3. Generate .env if missing ──
echo ""
echo "[3/8] Configuring environment..."
if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -base64 48)
  TURN_SECRET=$(openssl rand -base64 32)

  cat > .env << ENVEOF
NODE_ENV=production
PORT=$PORT
BASE_URL=https://$DOMAIN

JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
BCRYPT_ROUNDS=12

SESSION_CODE_EXPIRY_MINUTES=10
MAX_CODES_PER_IP_PER_HOUR=5

TURN_SERVER=turn:$DOMAIN:3478
TURN_SECRET=$TURN_SECRET
STUN_SERVER=stun:$DOMAIN:3478
ENVEOF

  echo "  .env created with auto-generated secrets"
else
  echo "  .env already exists — skipping"
fi

# ── 4. Build frontend ──
echo ""
echo "[4/8] Building frontend..."
npm run build 2>&1 | tail -3

# ── 5. Seed database ──
echo ""
echo "[5/8] Seeding database..."
npm run db:seed 2>&1

# ── 6. Nginx config ──
echo ""
echo "[6/8] Configuring nginx..."
cat > /etc/nginx/sites-available/remoteit << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/remoteit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  nginx configured and reloaded"

# ── 7. SSL certificate ──
echo ""
echo "[7/8] Setting up SSL..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>&1 | tail -3
echo "  SSL configured"

# ── 8. PM2 process manager ──
echo ""
echo "[8/8] Setting up PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

cd "$APP_DIR"
pm2 delete remoteit 2>/dev/null || true
pm2 start npm --name "remoteit" -- start
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | tail -1

echo ""
echo "============================================"
echo "  RemoteIT is live!"
echo "============================================"
echo ""
echo "  URL:       https://$DOMAIN"
echo "  Support:   https://$DOMAIN/support"
echo "  Dashboard: https://$DOMAIN/dashboard"
echo ""
echo "  Manage:    pm2 status | pm2 logs remoteit"
echo "============================================"
