# ─────────────────────────────────────────────────────────────────────────────
# Medi-Diagnoser — Frontend  (multi-stage build)
#
# Stage 1 — deps   : install node_modules
# Stage 2 — builder: build the Next.js app (standalone output)
# Stage 3 — runner : copy the minimal artefacts; final image ~200 MB
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
# --frozen-lockfile ensures CI/Docker builds never silently drift from lock file.
RUN npm ci --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined at build time by the Next.js compiler.
# Override at build time with:
#   docker build --build-arg NEXT_PUBLIC_API_URL=http://myserver:8000 …
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Runner (minimal production image) ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.ts `output: 'standalone'` generates server.js which reads PORT
# and HOSTNAME at startup — these two variables control the listener address.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy only what Next.js standalone output needs:
#   .next/standalone  → minimal server + inlined node_modules
#   .next/static      → hashed JS/CSS chunks (served by server.js)
#   public            → favicon, svgs, etc.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
