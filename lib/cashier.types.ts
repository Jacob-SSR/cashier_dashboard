// lib/cashier.types.ts
// type ที่ใช้ร่วมกันระหว่าง server (service/route) และ client (คอมโพเนนต์จอ)
// แยกไว้ไฟล์เดียวเพื่อให้ฝั่ง client import type ได้โดยไม่ลาก mysql2 เข้า bundle

/**
 * สถานะคิวชำระเงิน — ตัดสินจากยอดเงินอย่างเดียว
 * ส่วน "ใครถึงคิว" ดูที่ BoardRow.isCalling (หัวแถวของ oqueue) ไม่ใช่ที่นี่
 */
export type CashierStatus = "รอชำระ" | "ชำระแล้ว";

/**
 * เส้นทางหลังพบแพทย์ ตาม flow ผู้ป่วยนอก
 *   ไม่มียา → ห้องการเงิน → กลับบ้าน
 *   มียา    → ห้องยา → ส่งรายชื่อ → ห้องการเงิน → กลับไปรับยาที่ห้องยา
 */
export type CashierRoute = "มียา" | "ไม่มียา";

/**
 * 1 แถวดิบจากฐานข้อมูล — มี VN/HN
 * ⚠️ ใช้ภายใน server เท่านั้น ไม่เคยถูกส่งออกทาง API
 *    ทุกจอในระบบนี้เป็นจอสาธารณะให้คนไข้ดู จึงไม่ส่งข้อมูลระบุตัวตนลงเบราว์เซอร์
 */
export interface CashierRow {
  id: string;
  vn: string;
  hn: string;
  /** เลขคิวจริงจาก HOSxP (ovst.oqueue) — เลขเดียวกับที่จอคิวเดิมใช้ */
  queueNo: string;
  /** ovst.pt_priority — มากกว่า = ถูกเรียกก่อน (ผู้สูงอายุ/พระ/ฉุกเฉิน) */
  priority: number;
  name: string;
  /** ชื่อแผนกที่ส่งผู้ป่วยมา (kskdepartment.department) เช่น ห้องยา / ทันตกรรม */
  dept: string;
  /** เวลาที่ถูกส่งมาห้องการเงิน HH:MM */
  time: string;
  status: CashierStatus;
  route: CashierRoute;
  /** ขั้นตอนถัดไปหลังชำระเงิน — ว่างถ้ายังไม่ชำระ */
  nextStep: string;
  /** ยอดที่ต้องชำระ (บาท) */
  amount: number;
}

/**
 * ชุดข้อมูลดิบของทั้งวัน — ใช้ภายใน server เท่านั้น (มี VN/HN)
 * จอต่าง ๆ กินผลลัพธ์ที่กรองแล้วอย่าง BoardData / CallData แทน
 */
export interface CashierData {
  updatedAt: string;
  /** วันที่ของข้อมูล (YYYY-MM-DD ค.ศ.) */
  date: string;
  /** hosxp = ต่อฐานข้อมูลจริง, demo = ข้อมูลตัวอย่าง (ยังไม่ตั้งค่า DB) */
  source: "hosxp" | "demo";
  rows: CashierRow[];
  summary: {
    wait: number;
    done: number;
    total: number;
    /** ยอดรวมที่ยังค้างชำระ (รอชำระ + กำลังชำระ) */
    outstanding: number;
  };
}

/** 1 แถวบนจอคิว — ไม่มี VN/HN และนามสกุลถูกปิดบังแล้ว */
export interface BoardRow {
  id: string;
  /** เลขคิวจริงจาก HOSxP (ovst.oqueue) — ว่างถ้า visit นั้นไม่มีเลขคิว */
  queueNo: string;
  name: string;
  dept: string;
  time: string;
  /** มียา = จ่ายเงินแล้วต้องกลับไปรับยาที่ห้องยา */
  route: CashierRoute;
  amount: number;
  /** คิวที่ถึงตาแล้ว (หัวแถว) — จอจะไฮไลต์ให้เด่น */
  isCalling: boolean;
}

/** payload ที่ /api/queue ส่งกลับ (จอคิว) */
export interface BoardData {
  updatedAt: string;
  date: string;
  source: "hosxp" | "demo";
  /** "คิวรอ" — คนที่ยังไม่ถูกเรียก (สูงสุดตาม BOARD_ROWS) */
  rows: BoardRow[];
  /**
   * "เรียกคิว" — คนที่ห้องเก็บเงินกดเรียกล่าสุด (ใหม่สุดอยู่หน้า, จอเดิมโชว์ 2 คน)
   * มาจากตาราง sd_queue_calling จึงเป็นคนละชุดกับ rows ไม่ซ้ำกัน
   */
  called: BoardRow[];
  /** จำนวนที่ยังไม่ถูกเรียกทั้งหมด (รวมคนที่ยังไม่ขึ้นจอ) */
  waiting: number;
  /** ถูกเรียกไปแล้ววันนี้ */
  done: number;
}

/**
 * คิวสำหรับ "ประกาศเรียกชื่อ" — ใช้ชื่อเต็มเพราะต้องอ่านออกเสียง
 * ไม่มี VN/HN เช่นกัน และ key เป็นค่า hash ไว้ให้ client เทียบว่าเป็นคนใหม่หรือไม่
 */
export interface CallRow {
  key: string;
  queueNo: string;
  name: string;
  dept: string;
  amount: number;
}

/** payload ที่ /api/queue/call ส่งกลับ */
export interface CallData {
  updatedAt: string;
  /** คนที่ถึงคิวตอนนี้ (หัวแถว) — null ถ้าไม่มีใครรอ */
  calling: CallRow | null;
  waiting: number;
}
