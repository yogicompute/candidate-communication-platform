#!/usr/bin/env bash
# Render start step: apply migrations, load demo candidates, then run the dummy provider
# (a separate process on localhost) and the message scheduler alongside the Django API served by
# gunicorn. On the free plan nothing runs while the service sleeps; due messages go out on wake.
set -euo pipefail

PORT="${PORT:-8000}"
export PROVIDER_WEBHOOK_URL="${PROVIDER_WEBHOOK_URL:-http://127.0.0.1:${PORT}/api/v1/webhooks/provider/}"

python manage.py migrate --noinput
python manage.py seed_candidates

python -m providers.dummy_server &
python manage.py run_scheduler &

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 60 \
  --access-logfile -
