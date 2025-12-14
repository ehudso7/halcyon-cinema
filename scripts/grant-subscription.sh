#!/bin/bash
# Script to grant a subscription via the admin API
# Usage: ./scripts/grant-subscription.sh <email> <tier> <duration> <admin_secret> [base_url]
#
# Example:
#   ./scripts/grant-subscription.sh evertonhudson@icloud.com enterprise yearly $ADMIN_SECRET
#   ./scripts/grant-subscription.sh evertonhudson@icloud.com enterprise yearly $ADMIN_SECRET https://your-app.vercel.app

set -e

EMAIL="${1:-evertonhudson@icloud.com}"
TIER="${2:-enterprise}"
DURATION="${3:-yearly}"
ADMIN_SECRET="${4:-$ADMIN_SECRET}"
BASE_URL="${5:-http://localhost:3000}"

if [ -z "$ADMIN_SECRET" ]; then
  echo "Error: ADMIN_SECRET is required"
  echo "Usage: $0 <email> <tier> <duration> <admin_secret> [base_url]"
  exit 1
fi

echo "Granting $TIER $DURATION subscription to $EMAIL..."

curl -X POST "${BASE_URL}/api/admin/grant-subscription" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"tier\": \"$TIER\",
    \"duration\": \"$DURATION\",
    \"adminSecret\": \"$ADMIN_SECRET\"
  }"

echo ""
echo "Done!"
