# Stage 1: Build React/Vite dist (if dist/ is not already pre-built on host)
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Nginx Runtime serving dist/ and sharing ./:/app volume
FROM nginx:stable-alpine

WORKDIR /app

# Copy custom Nginx SPA + API proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled dist into Nginx web root (can also be overridden by ./dist:/usr/share/nginx/html volume)
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

