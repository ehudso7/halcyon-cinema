#!/bin/bash
# Script to grant a subscription via the admin API
# Usage: ./scripts/grant-subscription.sh <email> <tier> <duration> <admin_secret> [base_url]
#
# Arguments:
#   email        - Required. The user's email address
#   tier         - Required. Subscription tier: free, pro, or enterprise
#   duration     - Required. Subscription duration: monthly or yearly
#   admin_secret - Required. The admin API secret (or set ADMIN_SECRET env var)
#   base_url     - Optional. API base URL (default: http://localhost:3000)
#
# Example:
#   ./scripts/grant-subscription.sh user@example.com enterprise yearly $ADMIN_SECRET
#   ./scripts/grant-subscription.sh user@example.com pro monthly $ADMIN_SECRET https://your-app.vercel.app

set -e

EMAIL="$1"
TIER="$2"
DURATION="$3"
ADMIN_SECRET="${4:-$ADMIN_SECRET}"
BASE_URL="${5:-http://localhost:3000}"

# Validate required parameters
if [ -z "$EMAIL" ]; then
  echo "Error: EMAIL is required"
  echo "Usage: $0 <email> <tier> <duration> <admin_secret> [base_url]"
  exit 1
fi

if [ -z "$TIER" ]; then
  echo "Error: TIER is required (free, pro, or enterprise)"
  echo "Usage: $0 <email> <tier> <duration> <admin_secret> [base_url]"
  exit 1
fi

if [ -z "$DURATION" ]; then
  echo "Error: DURATION is required (monthly or yearly)"
  echo "Usage: $0 <email> <tier> <duration> <admin_secret> [base_url]"
  exit 1
fi

if [ -z "$ADMIN_SECRET" ]; then
  echo "Error: ADMIN_SECRET is required (pass as 4th argument or set env var)"
  echo "Usage: $0 <email> <tier> <duration> <admin_secret> [base_url]"
  exit 1
fi

# Validate tier
if [[ "$TIER" != "free" && "$TIER" != "pro" && "$TIER" != "enterprise" ]]; then
  echo "Error: Invalid tier '$TIER'. Must be: free, pro, or enterprise"
  exit 1
fi

# Validate duration
if [[ "$DURATION" != "monthly" && "$DURATION" != "yearly" ]]; then
  echo "Error: Invalid duration '$DURATION'. Must be: monthly or yearly"
  exit 1
fi

echo "Granting $TIER $DURATION subscription to $EMAIL..."

# Use stdin to pass JSON body (avoids exposing secret in process list)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/admin/grant-subscription" \
  -H "Content-Type: application/json" \
  --data-binary @- <<EOF
{
  "email": "$EMAIL",
  "tier": "$TIER",
  "duration": "$DURATION",
  "adminSecret": "$ADMIN_SECRET"
}
EOF
)

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Success!"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed with HTTP $HTTP_CODE:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  exit 1
fi
