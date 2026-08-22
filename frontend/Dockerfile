FROM node:22.23.2-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy the full frontend tree (see .dockerignore). Selective COPY missed
# tailwind.config.ts and can omit large tracked assets from src/assets.
COPY . .

# Same-origin API via nginx. Override only if the SPA is served without the proxy.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache wget

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Only substitute these so nginx $host / $uri stay intact.
# NGINX_ENVSUBST_FILTER is a regex (see nginx Docker image docs).
ENV NGINX_ENVSUBST_FILTER=API_UPSTREAM|PORT
ENV API_UPSTREAM=http://backend:8000
ENV PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/nginx-health || exit 1
