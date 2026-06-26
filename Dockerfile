FROM node:24-alpine AS base
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @repoready/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@repoready/web", "start"]
