# ห้องเก็บเงินแดง (cashier_dashboard) — Next.js 16 standalone, รันที่พอร์ต 4500
# ไม่ใส่ `# syntax=docker/dockerfile:1` ไว้บนสุด เพราะไม่ได้ใช้ฟีเจอร์พิเศษของ BuildKit
# และจะได้ไม่ต้องดึง image frontend เพิ่มตอน build (เครื่องที่เน็ตจำกัดจะ build ผ่าน)

FROM node:22-slim AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./

# เน็ตของ รพ. ช้าและหลุดบ่อย (ลงครั้งแรกใช้ 6 นาที และเคย npm ci ล้มกลางทาง)
# ค่าพวกนี้ทำให้ npm รอนานขึ้นและลองใหม่เองแทนที่จะยอมแพ้ทันที
#   --no-audit  ตัดการเรียก endpoint ตรวจช่องโหว่ ซึ่งช้ามากและไม่จำเป็นตอน build
#   --no-fund   ตัดข้อความขอบริจาค
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_fetch_timeout=600000
# ถ้า package-lock.json หลุด sync กับ package.json (เช่นถูก pull ทับจาก branch อื่น
# หรือถูกสร้างจาก npm คนละรุ่น) npm ci จะตายด้วย EUSAGE ทันที
# จอนี้ต้องขึ้นให้ได้ก่อน จึงถอยไป npm install ให้มันแก้ lock ในภาพเองแทนที่จะ build ไม่ผ่าน
# (เกิดจริงมาแล้ว: Missing @emnapi/runtime from lock file)
RUN npm ci --no-audit --no-fund \
    || (echo "!! package-lock.json ไม่ตรงกับ package.json - ถอยไปใช้ npm install" \
        && npm install --no-audit --no-fund)

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
