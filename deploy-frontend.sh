#!/bin/bash
set -e

ENV=$1

if [ -z "$ENV" ]; then
    echo "Usage: ./deploy-frontend.sh [testing|production]"
    exit 1
fi

PROJECT_DIR="/home/pras/Works/centralized-approval"
FRONTEND_DIR="$PROJECT_DIR/frontend"
REMOTE_USER_HOST="pree@172.16.110.14"

if [ "$ENV" == "testing" ] || [ "$ENV" == "sit" ]; then
    BRANCH="sit-testing"
    BUILD_CMD="build:testing"
    REMOTE_DIR="/var/www/sit-approval-workflow/frontend/"
elif [ "$ENV" == "production" ] || [ "$ENV" == "prod" ]; then
    BRANCH="department-approval"
    BUILD_CMD="build:prod"
    REMOTE_DIR="/var/www/approval-hub/frontend/"
else
    echo "❌ Environment tidak dikenali: $ENV (gunakan 'testing' atau 'production')"
    exit 1
fi

echo "=========================================="
echo "🚀 Deploying Centralized Approval Frontend ($ENV)"
echo "🌿 Branch      : $BRANCH"
echo "📦 Build Mode  : $BUILD_CMD"
echo "🖥️  Target SCP  : $REMOTE_USER_HOST:$REMOTE_DIR"
echo "=========================================="

cd "$PROJECT_DIR"
echo "=== [1/4] Checkout & Pull branch $BRANCH ==="
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

cd "$FRONTEND_DIR"
echo "=== [2/4] Building frontend ($BUILD_CMD) ==="
npm run "$BUILD_CMD"

echo "=== [3/4] Uploading dist/ to server via SCP ==="
scp -r dist/ "$REMOTE_USER_HOST:$REMOTE_DIR"

echo "=== [4/4] Deployment Selesai! ==="

