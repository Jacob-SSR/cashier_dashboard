// lib/cashier.types.ts
// type ที่ใช้ร่วมกันระหว่าง server (service/route) และ client (คอมโพเนนต์ dashboard)
// แยกไว้ไฟล์เดียวเพื่อให้ฝั่ง client import type ได้โดยไม่ลาก mysql2 เข้า bundle

/** สถานะคิวชำระเงิน — ตรงกับป้ายสถานะบนหน้าจอ */
export type CashierStatus = "รอชำระ" | "กำลังชำระ" | "ชำระแล้ว";

/** 1 แถว = 1 visit (VN) ที่ถูกส่งมาห้องเก็บเงิน */
export interface CashierRow {
  /** ใช้ vn เป็น key ของแถว (unique ต่อวัน) */
  id: string;
  vn: string;
  hn: string;
  name: string;
  /** ชื่อแผนกที่ส่งผู้ป่วยมา (kskdepartment.department) */
  dept: string;
  /** เวลาส่ง HH:MM */
  time: string;
  status: CashierStatus;
  /** ยอดที่ต้องชำระ (บาท) */
  amount: number;
}

/** payload ที่ /api/cashier ส่งกลับ */
export interface CashierData {
  updatedAt: string;
  /** วันที่ของข้อมูล (YYYY-MM-DD ค.ศ.) */
  date: string;
  /** hosxp = ต่อฐานข้อมูลจริง, demo = ข้อมูลตัวอย่าง (ยังไม่ตั้งค่า DB) */
  source: "hosxp" | "demo";
  rows: CashierRow[];
  summary: {
    wait: number;
    serving: number;
    done: number;
    total: number;
    /** ยอดรวมที่ยังค้างชำระ (รอชำระ + กำลังชำระ) */
    outstanding: number;
  };
}

/** 1 แถวบนจอ TV — ไม่มี VN/HN และนามสกุลถูกปิดบังแล้ว */
export interface TvRow {
  /** ลำดับคิวบนจอ (ไม่ใช่ vn — จอ TV ไม่ส่งข้อมูลระบุตัวตนออกไป) */
  id: string;
  name: string;
  dept: string;
  time: string;
  status: CashierStatus;
  amount: number;
}

/** payload ที่ /api/cashier/tv ส่งกลับ */
export interface TvData {
  updatedAt: string;
  date: string;
  source: "hosxp" | "demo";
  /** คิวที่แสดงบนจอ (สูงสุดตาม TV_ROWS) */
  rows: TvRow[];
  /** จำนวนที่ยังไม่ชำระทั้งหมด (รวมคนที่ยังไม่ขึ้นจอ) */
  waiting: number;
  /** ชำระเสร็จแล้ววันนี้ */
  done: number;
}
