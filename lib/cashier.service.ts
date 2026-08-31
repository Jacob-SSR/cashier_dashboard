// lib/cashier.service.ts
// ดึงคิว "ห้องเก็บเงิน" ของวันที่กำหนดจาก HOSxP แล้วแปลงเป็นแถวสำหรับหน้าจอ
//
// ตารางที่ใช้ (HOSxP):
//   ovst          = visit OPD ของวัน (cur_dep = แผนกที่อยู่ตอนนี้, last_dep = แผนกก่อนหน้า)
//   vn_stat       = ยอดเงินของ visit (income = ยอดรวม, paid_money = จ่ายแล้ว)
//   patient       = ชื่อ-นามสกุล
//   kskdepartment = ชื่อแผนก (depcode → department)
//   ovstost       = ชื่อสถานะผู้ป่วย เช่น "รอชำระเงิน", "รับยาแล้ว"
//
// การจับ "อยู่ในคิวห้องเก็บเงิน" ต่างกันในแต่ละ รพ. จึงเปิดให้ตั้งผ่าน env:
//   CASHIER_DEP_CODES=006,007   → รหัสแผนกห้องเก็บเงิน (kskdepartment.depcode)
// ถ้าไม่ตั้ง จะใช้เกณฑ์กลาง: visit ของวันนี้ที่มียอดเงิน (income > 0)
import { getDb, isDbConfigured } from "@/lib/db";
import { demoRows } from "@/lib/cashier.demo";
import { maskSurname } from "@/lib/mask";
import type {
  CashierData,
  CashierRow,
  CashierStatus,
  TvData,
} from "@/lib/cashier.types";

/** รหัสแผนกห้องเก็บเงิน — คั่นด้วย comma ใน env */
function cashierDepCodes(): string[] {
  return (process.env.CASHIER_DEP_CODES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Row {
  vn: string;
  hn: string;
  patient_name: string;
  dept_name: string;
  send_time: string;
  status_name: string;
  cur_dep: string;
  income: number;
  paid_money: number;
}

function clean(v: unknown): string {
  return (v == null ? "" : String(v)).trim();
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * แปลงข้อมูลดิบ 1 แถวเป็นสถานะบนหน้าจอ
 *   ชำระแล้ว  = จ่ายครบ (paid_money >= income) และมียอด
 *   กำลังชำระ = ยังไม่ครบ แต่ตอนนี้ยืนอยู่ที่ห้องเก็บเงิน (cur_dep ตรงกับที่ตั้งไว้)
 *               หรือชื่อสถานะใน HOSxP บอกว่ากำลังชำระ
 *   รอชำระ    = ที่เหลือ
 */
function toStatus(r: Row, depCodes: string[]): CashierStatus {
  const income = num(r.income);
  const paid = num(r.paid_money);
  if (income > 0 && paid >= income) return "ชำระแล้ว";

  const status = clean(r.status_name);
  if (status.includes("กำลังชำระ") || status.includes("กำลังรับเงิน"))
    return "กำลังชำระ";

  if (depCodes.length > 0 && depCodes.includes(clean(r.cur_dep)))
    return "กำลังชำระ";

  return "รอชำระ";
}

function buildSummary(rows: CashierRow[]): CashierData["summary"] {
  const wait = rows.filter((r) => r.status === "รอชำระ").length;
  const serving = rows.filter((r) => r.status === "กำลังชำระ").length;
  const done = rows.filter((r) => r.status === "ชำระแล้ว").length;
  const outstanding = rows
    .filter((r) => r.status !== "ชำระแล้ว")
    .reduce((s, r) => s + r.amount, 0);
  return { wait, serving, done, total: rows.length, outstanding };
}

async function queryHosxp(date: string): Promise<CashierRow[]> {
  const depCodes = cashierDepCodes();

  // เงื่อนไข "เข้าคิวห้องเก็บเงิน":
  //  - ตั้ง CASHIER_DEP_CODES → เอาคนที่อยู่/เพิ่งผ่านแผนกนั้น หรือจ่ายเงินแล้ว
  //  - ไม่ตั้ง → เอาทุก visit ที่มียอดเงิน
  const params: (string | number)[] = [date];
  let queueClause = "COALESCE(v.income, 0) > 0";
  if (depCodes.length > 0) {
    const placeholders = depCodes.map(() => "?").join(",");
    queueClause = `(o.cur_dep IN (${placeholders}) OR o.last_dep IN (${placeholders}) OR COALESCE(v.paid_money, 0) > 0)`;
    params.push(...depCodes, ...depCodes);
  }

  const sql = `
    SELECT
      o.vn                                       AS vn,
      o.hn                                       AS hn,
      CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
      COALESCE(kl.department, km.department, '') AS dept_name,
      TIME_FORMAT(o.vsttime, '%H:%i')            AS send_time,
      COALESCE(os.name, '')                      AS status_name,
      COALESCE(o.cur_dep, '')                    AS cur_dep,
      COALESCE(v.income, 0)                      AS income,
      COALESCE(v.paid_money, 0)                  AS paid_money
    FROM ovst o
    LEFT JOIN vn_stat       v  ON v.vn      = o.vn
    LEFT JOIN patient       p  ON p.hn      = o.hn
    LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
    LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
    LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
    WHERE o.vstdate = ?
      AND o.an IS NULL
      AND ${queueClause}
    ORDER BY o.vsttime
  `;

  const [rows] = (await getDb().query(sql, params)) as unknown as [Row[], unknown];

  return rows.map((r) => {
    const income = num(r.income);
    const paid = num(r.paid_money);
    const status = toStatus(r, depCodes);
    return {
      id: clean(r.vn),
      vn: clean(r.vn),
      hn: clean(r.hn),
      name: clean(r.patient_name) || clean(r.hn),
      dept: clean(r.dept_name) || "ไม่ระบุแผนก",
      time: clean(r.send_time),
      status,
      // ชำระแล้ว → โชว์ยอดที่จ่ายจริง, ยังไม่ชำระ → โชว์ยอดคงค้าง
      amount: status === "ชำระแล้ว" ? paid : Math.max(0, income - paid),
    };
  });
}

/** วันที่วันนี้แบบ YYYY-MM-DD ตามเวลาไทย (container รันเป็น UTC ได้) */
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ || "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function getCashierQueue(date?: string): Promise<CashierData> {
  const d = date || todayInBangkok();

  // ยังไม่ตั้ง DB (หรือบังคับ DEMO_MODE=1) → ข้อมูลตัวอย่าง ให้เปิดหน้าจอดูได้เลย
  if (!isDbConfigured()) {
    const rows = demoRows();
    return {
      updatedAt: new Date().toISOString(),
      date: d,
      source: "demo",
      rows,
      summary: buildSummary(rows),
    };
  }

  const rows = await queryHosxp(d);
  return {
    updatedAt: new Date().toISOString(),
    date: d,
    source: "hosxp",
    rows,
    summary: buildSummary(rows),
  };
}

// ─── จอ TV (หน้าจอสาธารณะ) ──────────────────────────────────────────────────
// ต่างจากคอนโซลเจ้าหน้าที่ 3 อย่าง:
//   1) ไม่ส่ง VN/HN ออกไปเลย — จอตั้งในที่สาธารณะ ข้อมูลระบุตัวตนไม่ควรออกจาก server
//   2) นามสกุลถูกปิดบัง (maskSurname)
//   3) เอาเฉพาะคนที่ยังไม่ชำระ เรียง "กำลังชำระ" ขึ้นก่อน แล้วตามเวลา
//      → พอคนหน้าจ่ายครบก็หลุดจากจอ คนถัดไปเลื่อนขึ้นมาเอง
const TV_ROWS_DEFAULT = 10;
const TV_ROWS_PER_COLUMN_DEFAULT = 5;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** จำนวนคิวทั้งหมดบนจอ TV */
export function tvRowLimit(): number {
  return positiveInt(process.env.TV_ROWS, TV_ROWS_DEFAULT);
}

/** จำนวนคิวต่อ 1 ช่อง — 10 คิว ÷ ช่องละ 5 = 2 ช่อง */
export function tvRowsPerColumn(): number {
  return positiveInt(process.env.TV_ROWS_PER_COLUMN, TV_ROWS_PER_COLUMN_DEFAULT);
}

export async function getTvQueue(date?: string): Promise<TvData> {
  const data = await getCashierQueue(date);

  const pending = data.rows
    .filter((r) => r.status !== "ชำระแล้ว")
    .sort((a, b) => {
      // คนที่อยู่หน้าเคาน์เตอร์ (กำลังชำระ) ขึ้นบนสุดเสมอ ที่เหลือเรียงตามเวลาส่ง
      const rank = (s: CashierStatus) => (s === "กำลังชำระ" ? 0 : 1);
      return rank(a.status) - rank(b.status) || a.time.localeCompare(b.time);
    });

  return {
    updatedAt: data.updatedAt,
    date: data.date,
    source: data.source,
    rows: pending.slice(0, tvRowLimit()).map((r, i) => ({
      id: String(i + 1),
      name: maskSurname(r.name),
      dept: r.dept,
      time: r.time,
      status: r.status,
      amount: r.amount,
    })),
    waiting: pending.length,
    done: data.rows.filter((r) => r.status === "ชำระแล้ว").length,
  };
}
