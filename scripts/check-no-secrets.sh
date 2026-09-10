#!/usr/bin/env bash
# Fails if any server-side secret appears in the client bundle.
# Run after `npm run build`.
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "no .env.local"; exit 1; }
[ -d .next/static ] || { echo "run npm run build first"; exit 1; }
set -a; . ./.env.local; set +a

fail=0
for name in DEEPGRAM_API_KEY OPENAI_API_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_URL VERCEL_TOKEN; do
  value="${!name:-}"
  [ -z "$value" ] && continue
  if grep -rqF "$value" .next/static 2>/dev/null; then
    echo "LEAK  $name is present in the client bundle"
    fail=1
  else
    echo "clean $name"
  fi
done
exit $fail
