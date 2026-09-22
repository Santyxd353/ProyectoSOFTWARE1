#!/usr/bin/env bash
set -euo pipefail

APP_ORIGIN="${1:?usage: bootstrap.sh http(s)://host}"
REPO_URL="https://github.com/Santyxd353/ProyectoSOFTWARE1.git"
REPO_BRANCH="feature/security-ai-mobile-polish"
GROQ_SOURCE="/tmp/backend.local.env"

if [[ ! -f "${GROQ_SOURCE}" ]]; then
  echo "Missing private Groq source file" >&2
  exit 1
fi
GROQ_API_KEY="$(awk -F= '/^GROQ_API_KEY=/{sub(/^GROQ_API_KEY=/, ""); gsub(/^"|"$/, ""); print; exit}' "${GROQ_SOURCE}")"
if [[ "${GROQ_API_KEY}" != gsk_* ]]; then
  echo "Invalid Groq key" >&2
  exit 1
fi

if ! id proyecto >/dev/null 2>&1; then
  sudo useradd --system --home /opt/proyecto --shell /usr/sbin/nologin proyecto
fi
sudo install -d -o azureuser -g azureuser /opt/proyecto/releases
sudo install -d -o root -g root -m 700 /etc/proyecto-software1
sudo install -d -o proyecto -g proyecto \
  /var/lib/proyecto-software1/generated-projects \
  /var/lib/proyecto-software1/artifacts

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE_DIR="/opt/proyecto/releases/${RELEASE_ID}"
git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${RELEASE_DIR}"

DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='proyecto'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER ROLE proyecto WITH LOGIN PASSWORD '${DB_PASSWORD}'"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE proyecto WITH LOGIN PASSWORD '${DB_PASSWORD}'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='uml_platform'" | grep -q 1; then
  sudo -u postgres createdb --owner=proyecto uml_platform
fi

PRIVATE_ENV="$(mktemp)"
umask 077
cat >"${PRIVATE_ENV}" <<EOF
DATABASE_URL=postgresql://proyecto:${DB_PASSWORD}@127.0.0.1:5432/uml_platform?schema=public
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
AI_PROVIDER=groq
GROQ_API_KEY=${GROQ_API_KEY}
AI_MODEL_MAIN=qwen/qwen3.8-27b
AI_MODEL_FAST=qwen/qwen3.8-27b
CORS_ORIGIN=${APP_ORIGIN}
FRONTEND_URL=${APP_ORIGIN}
PORT=3002
GENERATED_PROJECTS_PATH=/var/lib/proyecto-software1/generated-projects
ARTIFACT_STORAGE_PATH=/var/lib/proyecto-software1/artifacts
REPOSITORY_TEXT_MAX_BYTES=1000000
REPOSITORY_DIFF_MAX_BYTES=1000000
EOF
sudo install -o root -g root -m 600 "${PRIVATE_ENV}" \
  /etc/proyecto-software1/backend.env
rm -f "${PRIVATE_ENV}" "${GROQ_SOURCE}"

cat >"${RELEASE_DIR}/frontend/.env.production.local" <<EOF
NEXT_PUBLIC_API_URL=${APP_ORIGIN}/api
NEXT_PUBLIC_WS_URL=${APP_ORIGIN}
EOF

cd "${RELEASE_DIR}/backend"
npm ci
npx prisma generate
npm run build
sudo bash -c "set -a; source /etc/proyecto-software1/backend.env; set +a; cd '${RELEASE_DIR}/backend'; npx prisma migrate deploy"

cd "${RELEASE_DIR}/frontend"
npm ci
npm run build

sudo chown -R proyecto:proyecto "${RELEASE_DIR}"
sudo ln -sfn "${RELEASE_DIR}" /opt/proyecto/current
sudo install -o root -g root -m 644 \
  "${RELEASE_DIR}/deploy/azure/proyecto-backend.service" \
  /etc/systemd/system/proyecto-backend.service
sudo install -o root -g root -m 644 \
  "${RELEASE_DIR}/deploy/azure/proyecto-frontend.service" \
  /etc/systemd/system/proyecto-frontend.service

HOST="${APP_ORIGIN#http://}"
HOST="${HOST#https://}"
if [[ "${APP_ORIGIN}" == http://* ]]; then
  CADDY_SITE="http://${HOST}"
else
  CADDY_SITE="${HOST}"
fi
sed "s|REPLACE_DOMAIN|${CADDY_SITE}|g" \
  "${RELEASE_DIR}/deploy/azure/Caddyfile.example" >/tmp/Caddyfile.proyecto
sudo install -o root -g root -m 644 /tmp/Caddyfile.proyecto /etc/caddy/Caddyfile
rm -f /tmp/Caddyfile.proyecto
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now proyecto-backend proyecto-frontend caddy
sudo systemctl restart proyecto-backend proyecto-frontend caddy

echo "Release ${RELEASE_ID} deployed to ${APP_ORIGIN}"
