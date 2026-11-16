#!/usr/bin/env bash
# One-time deploy: seeds Neon from ../game-docs, links a Vercel project,
# copies .env.local into Vercel's production env, and deploys.
# Run from bible-quest/:  bash scripts/vercel-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo "Missing .env.local (see .env.example)"; exit 1; }
set -a; source .env.local; set +a

if [ -z "${APP_PASSCODE:-}" ]; then
  read -r -s -p "Pick a passcode for the site: " APP_PASSCODE; echo
  [ -n "$APP_PASSCODE" ] || { echo "A passcode is required"; exit 1; }
  printf '\nAPP_PASSCODE=%s\n' "$APP_PASSCODE" >> .env.local
fi

echo "→ Installing packages"
npm install --no-audit --no-fund

echo "→ Seeding the database from ../game-docs"
npm run db:seed || echo "  (already seeded, skipping. Use: npm run db:seed -- --force to overwrite)"

echo "→ Linking the Vercel project"
npx vercel link --yes --project bible-quest

echo "→ Setting production environment variables"
for name in DATABASE_URL NEON_REALTIME_URL NEON_REALTIME_SECRET APP_PASSCODE; do
  val=$(grep -m1 "^$name=" .env.local | cut -d= -f2-)
  [ -n "$val" ] || { echo "  $name missing from .env.local"; exit 1; }
  npx vercel env add "$name" --environment production --value "$val" --force --yes >/dev/null
  echo "  $name ✓"
done

echo "→ Deploying"
npx vercel deploy --prod
