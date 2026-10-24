# Web image (PRD §8.4): the static build served by nginx, which also forwards
# /api to the API container so the browser only ever sees one origin.
# Build with the repository root as context:
#
#   docker build -f apps/web/Dockerfile -t mensal-web .
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/shared packages/shared
ARG VITE_OTLP_PATH
ARG VITE_DEPLOYMENT_ENVIRONMENT
RUN npm run build:web

FROM nginx:1-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
