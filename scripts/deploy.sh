#!/usr/bin/env bash
# Deploy Focus Reader to Cloudflare.
# Usage: ./scripts/deploy.sh [web|email|rss|all]
#   Defaults to "all" if no argument given.

set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-all}"

echo "==> Building all packages..."
pnpm build
pnpm typecheck

echo "==> Running D1 migrations..."
npx wrangler d1 migrations apply FOCUS_DB --remote --config packages/db/wrangler.toml

deploy_web() {
  echo "==> Deploying web app..."
  cd apps/web
  npx opennextjs-cloudflare build
  npx wrangler deploy
  cd ../..
}

deploy_email() {
  echo "==> Deploying email worker..."
  npx wrangler deploy --config apps/email-worker/wrangler.toml
}

deploy_rss() {
  echo "==> Deploying RSS worker..."
  npx wrangler deploy --config apps/rss-worker/wrangler.toml
}

case "$TARGET" in
  web)    deploy_web ;;
  email)  deploy_email ;;
  rss)    deploy_rss ;;
  all)
    deploy_web
    deploy_email
    deploy_rss
    ;;
  *)
    echo "Unknown target: $TARGET"
    echo "Usage: $0 [web|email|rss|all]"
    exit 1
    ;;
esac

echo "==> Deploy complete."
