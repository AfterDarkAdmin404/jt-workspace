# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
WORKDIR /app

# Native build toolchain for bcrypt on Alpine
RUN apk add --no-cache python3 make g++ \
  && corepack enable

# Copy workspace manifests, lockfile, and registry auth config for Yarn 4 install (NestJS API + nest-lib only)
COPY package.json yarn.lock .yarnrc.yml .npmrc nx.json tsconfig*.json ./
COPY .yarn/plugins/check-gh-pat.cjs .yarn/plugins/check-gh-pat.cjs
COPY tools/scripts/check-gh-pat.js tools/scripts/check-gh-pat.js
COPY libs/nest-lib/package.json libs/nest-lib/package.json
COPY apps/ikagi-api/package.json apps/ikagi-api/package.json

RUN --mount=type=secret,id=gh_pat \
  GH_PAT="$(cat /run/secrets/gh_pat)" yarn install --immutable

# Copy shared NestJS library (auth, audit, cache, rate-limit, entities/migrations) and ikagi-api
COPY libs/nest-lib ./libs/nest-lib
COPY apps/ikagi-api ./apps/ikagi-api

# Build shared library first, then ikagi-api
RUN yarn --cwd libs/nest-lib build \
  && yarn nx build @org/ikagi-api

FROM node:24-alpine AS runner
ENV APP_NAME=ikagi-api
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs/nest-lib/package.json ./libs/nest-lib/package.json
COPY --from=builder /app/libs/nest-lib/dist ./libs/nest-lib/dist
COPY --from=builder /app/apps/ikagi-api/package.json ./apps/ikagi-api/package.json
COPY --from=builder /app/apps/ikagi-api/dist ./apps/ikagi-api/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "apps/ikagi-api/dist/main.js"]
