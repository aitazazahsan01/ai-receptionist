FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY agent/package.json agent/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY agent/. .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY agent/package.json agent/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Pre-fetches plugin model files (e.g. Silero VAD weights) at build time so the
# container doesn't need to do it on every cold start.
RUN node dist/agent.js download-files

# No exposed port -- this is an outbound worker that connects out to LiveKit,
# it isn't a server other containers connect into.
CMD ["node", "dist/agent.js", "start"]
