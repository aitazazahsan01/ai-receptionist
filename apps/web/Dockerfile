FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY apps/web/. .
# Baked in at build time -- this becomes part of the client JS bundle, so it
# can't be an env var read at container start (see next.config's NEXT_PUBLIC_
# handling). Override via --build-arg for a non-default backend URL.
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# Explicit -- server.js needs to bind all interfaces to be reachable through
# Docker's port mapping, not just the default loopback-only binding.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
