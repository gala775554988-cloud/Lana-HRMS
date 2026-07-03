$ErrorActionPreference = "Stop"
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
