# Build from repository root (root .dockerignore trims context):
#   docker build -f apps/api/Dockerfile -t notary-portal-api .

FROM node:22-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo
ENV CI=true HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps apps
COPY libs libs
COPY scripts scripts
COPY eslint.config.mjs jest.preset.js jest.config.ts ./

RUN pnpm install --frozen-lockfile
RUN pnpm exec nx run api:build:production --skip-nx-cache

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/dist/apps/api/ ./

# Prisma runtime is external in the webpack bundle; align @prisma/client with @prisma/adapter-pg.
RUN node -e "\
const fs=require('fs');\
const p=JSON.parse(fs.readFileSync('package.json','utf8'));\
const v=p.dependencies['@prisma/adapter-pg']||'7.4.2';\
p.dependencies['@prisma/client']=v;\
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n');\
"

RUN npm install --omit=dev \
  && chown -R node:node /app

EXPOSE 3000
USER node
CMD ["node", "main.js"]
