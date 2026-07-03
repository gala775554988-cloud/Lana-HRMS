#!/usr/bin/env bash
set -euo pipefail
npm install
npx prisma generate
npm run lint
npm run build
npx prisma migrate deploy
