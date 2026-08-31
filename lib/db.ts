// lib/db.ts
// connection pool ไป HOSxP (MySQL) — ตั้งค่าเหมือนโปรเจกต์ ppc-hos-10667
//
// ต่างจากที่นั่นตรงที่ "ไม่ throw ตอน import" ถ้าไม่มี env ครบ:
// dashboard ตัวนี้ต้องรันโหมด demo ได้ (docker compose up แล้วเห็นหน้าจอทันที)
// แล้วค่อยเติม .env.production ทีหลัง → ดู isDbConfigured()
import mysql from "mysql2/promise";

const REQUIRED_DB_ENV = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"] as const;

/** ตั้งค่า DB ครบหรือยัง — ถ้าไม่ครบ service จะ fallback เป็นข้อมูลตัวอย่าง */
export function isDbConfigured(): boolean {
  if (process.env.DEMO_MODE === "1") return false;
  return REQUIRED_DB_ENV.every((k) => !!process.env[k]);
}

let pool: mysql.Pool | null = null;

/**
 * pool แบบ lazy — สร้างครั้งแรกที่เรียกใช้จริง
 * (ไม่สร้างตอน import เพื่อให้ build/รันโหมด demo ได้โดยไม่ต้องมี DB)
 */
export function getDb(): mysql.Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: "tis620", // HOSxP ใช้ tis620 — อย่าเปลี่ยน

    // ⚠️ ห้ามตั้งเป็น true: เปิดทาง stacked-query SQL injection
    multipleStatements: false,

    // จำกัดขนาด pool ให้ชัด — หน้าจอนี้ auto refresh ทุก 15 วิ
    // ถ้าเปิดหลายจอพร้อมกันแล้ว pool ไม่จำกัด จะยิงใส่ HOSxP ตัวจริงจนงานประจำสะดุด
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 8),
    maxIdle: Number(process.env.DB_POOL_IDLE ?? 4),
    idleTimeout: 60_000,
    waitForConnections: true,
    queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 100),
    connectTimeout: 10_000,
    enableKeepAlive: true, // กัน connection ตายเงียบเวลาข้าม LAN/NAT
    keepAliveInitialDelay: 30_000,
  });

  return pool;
}
