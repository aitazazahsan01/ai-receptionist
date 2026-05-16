FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY apps/web/. .
# Baked in at build time -- this becomes part of the client JS bundle, so it
# can't be an env var read at container start (see next.config's NEXT_PUBLIC_
