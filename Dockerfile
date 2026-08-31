# ห้องเก็บเงินแดง (cashier_dashboard) — Next.js 16 standalone, รันที่พอร์ต 4500
# ไม่ใส่ `# syntax=docker/dockerfile:1` ไว้บนสุด เพราะไม่ได้ใช้ฟีเจอร์พิเศษของ BuildKit
# และจะได้ไม่ต้องดึง image frontend เพิ่มตอน build (เครื่องที่เน็ตจำกัดจะ build ผ่าน)

FROM node:22-slim AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# หมายเหตุตอน build:
#  1) เครื่องที่ build ต้องต่อเน็ตได้ เพราะ next/font/google โหลดฟอนต์ Sarabun ตอน build
#  2) ค่า env ของ DB ไม่จำเป็นตอน build — lib/db.ts สร้าง pool แบบ lazy ตอน runtime
RUN npm run build

# ---------- runner (production) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Bangkok

# รันด้วย user ที่ไม่ใช่ root
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# copy เฉพาะผลลัพธ์ standalone (image เล็ก + ไม่มี .env ติดไปใน image)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# ── แยกพอร์ตเป็น 4500 (ppc-hos-dashboard ใช้ 3000 อยู่ จะได้ไม่ชนกัน) ──
EXPOSE 4500
ENV PORT=4500
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
