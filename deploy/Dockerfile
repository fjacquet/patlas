# syntax=docker/dockerfile:1
#
# Self-host image for patlas — a 100% client-side static site. The build
# context is the repository ROOT:
#
#   docker build -f deploy/Dockerfile -t patlas .
#
# Stage 1 builds the static bundle with VITE_BASE=/ so it serves at the host
# root (not the GitHub Pages /patlas/ subpath). Stage 2 serves it with
# nginx-unprivileged on :8080 as a non-root user (uid 101) — no root, no setcap.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
# Copy manifests first so `npm ci` is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Root-path build for self-hosting. Override (e.g. VITE_BASE=/patlas/) to serve
# under a subpath behind a reverse proxy.
ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}
RUN npm run build

# ---- runtime ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Our SPA + wasm-aware server block replaces the image default.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
