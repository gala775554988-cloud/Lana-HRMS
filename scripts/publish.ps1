$ErrorActionPreference = "Stop"
npm run lint
npm run build
vercel --prod
