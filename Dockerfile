# Ascendium One — production image (Next.js standalone output)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# Bake a seeded SQLite database into the image so a fresh named volume
# initialises with the full AGH structure and labelled demo data.
FROM builder AS seed
ENV DATABASE_URL="file:/data/ascendium.db"
RUN mkdir -p /data \
  && npx prisma db push \
  && npx tsx prisma/seed.ts

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S ascendium && adduser -S ascendium -G ascendium
COPY --from=seed /data /data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=ascendium:ascendium /app/.next/standalone ./
COPY --from=builder --chown=ascendium:ascendium /app/.next/static ./.next/static
RUN chown -R ascendium:ascendium /data
USER ascendium
EXPOSE 3100
ENV PORT=3100 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
