$ErrorActionPreference = "Stop"
npm install
npx prisma generate
npm run lint
npm run build
npx prisma migrate deploy
