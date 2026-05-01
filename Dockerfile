# ---- Builder ----
FROM node:lts-alpine AS builder

WORKDIR /app

RUN apk add --no-cache make g++
COPY package*.json ./
RUN npm ci

# Public build-time vars (not secrets — safe to bake into the image)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL

# Copy source code
COPY ./app ./app
COPY ./public ./public
COPY ./lib ./lib
COPY ./next.config.ts .
COPY ./tsconfig.json .
COPY ./proxy.ts .
COPY ./postcss.config.mjs .
COPY ./eslint.config.mjs .

# Build the app
RUN npm run build

# ---- Runner ----
FROM node:lts-alpine AS runner

WORKDIR /app


RUN apk add --no-cache make g++
COPY package*.json ./
RUN npm ci --only=production

# Copy built output and required files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/proxy.ts ./proxy.ts
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/eslint.config.mjs ./eslint.config.mjs

# Copy header-generator data files for got-scraping to work in production
COPY --from=builder /app/node_modules/header-generator/data_files ./node_modules/header-generator/data_files

# Next.js bundled runtime may resolve __dirname under /ROOT in server chunks.
# Mirror the same data files there so header-generator can load its assets.
RUN mkdir -p /ROOT/node_modules/header-generator
COPY --from=builder /app/node_modules/header-generator/data_files /ROOT/node_modules/header-generator/data_files

# Runtime secrets (CLERK_SECRET_KEY, MONGODB_URI, etc.) are injected by docker-compose, not baked in

EXPOSE 3000

CMD ["npm", "start"]
