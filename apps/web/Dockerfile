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
COPY eslint.config.mjs jest.preset.js jest.config.ts ./

RUN pnpm install --frozen-lockfile

# Build-time flag for Angular `define` (libs/web/guest login hints). Compose: build.args from .env.portal.
ARG NG_APP_SHOW_TEST_ACCOUNTS=false
ENV NG_APP_SHOW_TEST_ACCOUNTS=${NG_APP_SHOW_TEST_ACCOUNTS}
RUN node -e "\
const fs=require('fs');\
const p='apps/web/project.json';\
const j=JSON.parse(fs.readFileSync(p,'utf8'));\
const v=(process.env.NG_APP_SHOW_TEST_ACCOUNTS||'false').toLowerCase();\
const flag=v==='true'||v==='1';\
j.targets.build.configurations.production.define=Object.assign(\
  {},\
  j.targets.build.configurations.production.define||{},\
  { NG_APP_SHOW_TEST_ACCOUNTS: flag ? 'true' : 'false' }\
);\
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\\n');\
"

RUN pnpm exec nx run web:build --configuration=production

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx/portal.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
