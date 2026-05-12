FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json modules.config.ts ./
COPY .npmrc ./
COPY .pnpmfile.cjs ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm install --frozen-lockfile
RUN pnpm generate
RUN pnpm build

FROM base AS api
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@tentacrawl/api", "run", "start:prod"]

FROM base AS worker
ENV PORT=3002
EXPOSE 3002
CMD ["pnpm", "--filter", "@tentacrawl/worker", "run", "start:prod"]

FROM base AS web
ENV PORT=3001
EXPOSE 3001
CMD ["pnpm", "--filter", "@tentacrawl/web", "run", "start"]