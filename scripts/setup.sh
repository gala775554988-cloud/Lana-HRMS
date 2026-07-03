#!/usr/bin/env bash
set -euo pipefail
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
