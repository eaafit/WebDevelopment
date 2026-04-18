# Build from repository root (see apps/web/DOCKER.md). Root .dockerignore trims context.
#   docker build -f apps/web/Dockerfile -t notary-portal-web .

FROM node:22-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo
ENV CI=true HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps apps
COPY libs libs
COPY scripts scripts
COPY eslint.config.mjs jest.preset.js jest.config.ts tsconfig.json ./

RUN pnpm install --frozen-lockfile
RUN pnpm exec nx run web:build --configuration=production

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx/portal.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
