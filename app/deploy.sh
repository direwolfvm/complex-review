#!/bin/bash
set -e

# ============================================
# Google Cloud Run Deployment Script
# ============================================
#
# Prerequisites:
# 1. Google Cloud SDK installed (gcloud CLI)
# 2. Authenticated: gcloud auth login
# 3. Project selected: gcloud config set project YOUR_PROJECT_ID
# 4. APIs enabled: Cloud Run, Cloud Build, Artifact Registry
#
# Usage:
#   ./deploy.sh
#
# Or with custom settings:
#   PROJECT_ID=my-project SERVICE_NAME=my-app REGION=us-west1 ./deploy.sh
# ============================================

# Configuration (override with environment variables)
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
SERVICE_NAME="${SERVICE_NAME:-complex-review}"
REGION="${REGION:-us-central1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying to Google Cloud Run${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Project:  ${YELLOW}${PROJECT_ID}${NC}"
echo -e "Service:  ${YELLOW}${SERVICE_NAME}${NC}"
echo -e "Region:   ${YELLOW}${REGION}${NC}"
echo -e "Image:    ${YELLOW}${IMAGE_NAME}${NC}"
echo ""

# Check for required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_URL is required${NC}"
    echo "Set it with: export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is required${NC}"
    echo "Set it with: export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
    exit 1
fi

# Default APP_BASE_URL if not set (will be updated after first deploy)
NEXT_PUBLIC_APP_BASE_URL="${NEXT_PUBLIC_APP_BASE_URL:-https://${SERVICE_NAME}-${PROJECT_ID}.${REGION}.run.app}"

echo -e "${GREEN}Step 1: Building container image...${NC}"
gcloud builds submit --tag "${IMAGE_NAME}" \
    --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
    --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    --build-arg "NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}"

echo ""
echo -e "${GREEN}Step 2: Deploying to Cloud Run...${NC}"

# Build the gcloud run deploy command
DEPLOY_CMD="gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    --set-env-vars NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}"

# Add optional environment variables if set
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    DEPLOY_CMD="${DEPLOY_CMD} --set-env-vars SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
fi

if [ -n "$HEDGEDOC_BASE_URL" ]; then
    DEPLOY_CMD="${DEPLOY_CMD} --set-env-vars HEDGEDOC_BASE_URL=${HEDGEDOC_BASE_URL}"
fi

if [ -n "$HEDGEDOC_API_TOKEN" ]; then
    DEPLOY_CMD="${DEPLOY_CMD} --set-env-vars HEDGEDOC_API_TOKEN=${HEDGEDOC_API_TOKEN}"
fi

# Execute deployment
eval $DEPLOY_CMD

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo -e "Service URL: ${YELLOW}${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}Note: If this is your first deployment, you may need to update${NC}"
echo -e "${YELLOW}NEXT_PUBLIC_APP_BASE_URL and redeploy for OAuth callbacks to work:${NC}"
echo ""
echo "  export NEXT_PUBLIC_APP_BASE_URL=${SERVICE_URL}"
echo "  ./deploy.sh"
echo ""
