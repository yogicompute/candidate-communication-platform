#!/usr/bin/env bash
# Render build step: install dependencies and collect static files for the Django admin.
set -euo pipefail

pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --noinput
