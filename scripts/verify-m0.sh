#!/bin/bash

set -e

echo "🚀 M0 Verification Script"
echo ""

# 1. Check env setup
echo "1. Checking environment..."
if [ -f .env.local ]; then
  echo "   ✓ .env.local exists"
else
  echo "   ✗ .env.local missing! Copy from .env.local.example and fill with credentials"
  exit 1
fi

# 2. List monorepo structure
echo "2. Checking monorepo structure..."
if [ -f package.json ]; then
  echo "   ✓ Root package.json found"
else
  echo "   ✗ Root package.json missing"
  exit 1
fi

# 3. Check all apps
echo "3. Checking all app directories..."
for app in absensi stok distribusi owner-dashboard; do
  if [ -d "apps/$app" ]; then
    echo "   ✓ apps/$app exists"
  else
    echo "   ✗ apps/$app missing"
    exit 1
  fi
done

# 4. Check packages
echo "4. Checking package directories..."
for pkg in design-system offline-queue; do
  if [ -d "packages/$pkg" ]; then
    echo "   ✓ packages/$pkg exists"
  else
    echo "   ✗ packages/$pkg missing"
    exit 1
  fi
done

# 5. Check Supabase migrations
echo "5. Checking Supabase migrations..."
MIGRATION_COUNT=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l)
echo "   ✓ Found $MIGRATION_COUNT SQL migration files"

echo ""
echo "✅ M0 Foundation Verification Complete!"
echo ""
echo "Next steps:"
echo "  1. yarn install  # Install dependencies"
echo "  2. supabase link --project-ref <project-id>"
echo "  3. supabase db push  # Apply migrations"
echo "  4. supabase db seed < supabase/seed.sql"
echo "  5. yarn dev  # Start all apps"
