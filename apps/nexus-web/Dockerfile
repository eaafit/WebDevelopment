# syntax=docker/dockerfile:1
# Build from repository root:
#   docker build -f apps/nexus-web/Dockerfile -t nexus-web .
# BuildKit picks up apps/nexus-web/Dockerfile.dockerignore automatically.

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS builder
ARG NEXUS_BUILD_ID=
ENV NEXUS_BUILD_ID=${NEXUS_BUILD_ID}
ENV CI=true HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/nexus-web ./apps/nexus-web
COPY libs/api/shared/prisma ./libs/api/shared/prisma
COPY libs/shared/api-contracts ./libs/shared/api-contracts

RUN pnpm install --frozen-lockfile --filter nexus-web...

WORKDIR /repo/apps/nexus-web
RUN pnpm run build

FROM base AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3000
ENV CI=true HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/nexus-web ./apps/nexus-web
COPY libs/api/shared/prisma ./libs/api/shared/prisma
COPY libs/shared/api-contracts ./libs/shared/api-contracts

COPY --from=builder /repo/apps/nexus-web/.nexus ./apps/nexus-web/.nexus

# Root `prepare` runs `husky`, which is not installed with --prod.
RUN node -e "const fs=require('fs');const p='./package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));delete j.scripts?.prepare;fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"

RUN pnpm install --frozen-lockfile --filter nexus-web... --prod

WORKDIR /repo/apps/nexus-web
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "exec", "nexus", "start"]
