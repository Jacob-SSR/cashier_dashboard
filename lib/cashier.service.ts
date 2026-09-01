// lib/cashier.service.ts
// ดึงคิว "ห้องการเงิน" ของวันที่กำหนดจาก HOSxP แล้วแปลงเป็นแถวสำหรับหน้าจอ
//
// ── ยึดตาม flow ผู้ป่วยนอก (docs/OPD_FLOW.md) ────────────────────────────────
//   Triage ─┬─ ER ────────────────────────────────────┐
//           └─ OPD: ห้องบัตร → ซักประวัติ → หน้าห้องตรวจ → พบแพทย์
//                                                      │
//                          หลังพบแพทย์ ─┬─ Admit → เข้า Ward (จบ ไม่มาการเงิน)
//                                       └─ (รับบัตรนัด) ─┬─ ไม่มียา → ห้องการเงิน → กลับบ้าน
//                                                        └─ มียา → ห้องยา → ส่งรายชื่อ
//                                                                  → ห้องการเงิน → กลับรับยา
//
// สิ่งที่ flow บังคับกับ query นี้:
//   1) Admit = terminal → ตัดออก (o.an IS NULL)
//   2) เอาเฉพาะคนที่ "ถูกส่งมาห้องการเงินแล้ว" ไม่ใช่ทุก visit ที่มีค่าใช้จ่าย
//      คนที่ยังอยู่หน้าห้องตรวจ/กำลังพบแพทย์ ยังไม่ใช่คิวของห้องการเงิน
//   3) คนมียาเข้าคิวการเงิน "หลังผ่านห้องยา" ไม่ใช่ทันทีที่ตรวจเสร็จ
//
// ตารางที่ใช้ (HOSxP):
//   ovst          visit OPD ของวัน (cur_dep = แผนกที่อยู่ตอนนี้, an = เลข admit)
//   service_time  เวลาแต่ละจุดบริการ — service12 ตรวจเสร็จ, service6 ถึงห้องยา,
//                 service16 รับยาแล้ว (คอลัมน์ชุดเดียวกับที่ ppc-hos-10667 ใช้)
//   opitemrece + drugitems  ใช้ตัดสิน "มียา / ไม่มียา"
//   vn_stat       ยอดเงิน (income = ยอดรวม, paid_money = จ่ายแล้ว)
//   patient / kskdepartment / ovstost  ชื่อคนไข้ / ชื่อแผนก / ชื่อสถานะ
import { getDb, isDbConfigured } from "@/lib/db";
import { demoRows } from "@/lib/cashier.demo";
import { maskSurname } from "@/lib/mask";
import type {
  CashierData,
  CashierRoute,
  CashierRow,
  CashierStatus,
  TvData,
} from "@/lib/cashier.types";

/** รหัสแผนกห้องการเงิน (kskdepartment.depcode) — คั่นด้วย comma ใน env */
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
  has_drug: number;
  drug_received: number;
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
 *   กำลังชำระ = ยังไม่ครบ แต่ตอนนี้ยืนอยู่ที่ห้องการเงิน (cur_dep ตรงกับที่ตั้งไว้)
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

/**
 * ขั้นตอนถัดไปหลังชำระเงิน ตาม flow
 *   ไม่มียา            → กลับบ้าน
 *   มียา + ยังไม่รับยา → กลับไปรับยาที่ห้องยา
 *   มียา + รับยาแล้ว   → กลับบ้าน
 * คืนค่าว่างถ้ายังไม่ชำระ (ยังไม่ถึงขั้นนี้)
 */
function nextStepOf(
  status: CashierStatus,
  route: CashierRoute,
  drugReceived: boolean,
): string {
  if (status !== "ชำระแล้ว") return "";
  if (route === "มียา" && !drugReceived) return "กลับไปรับยาที่ห้องยา";
  return "กลับบ้าน";
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
  const params: (string | number)[] = [date];

  // ── เงื่อนไข "ถูกส่งมาห้องการเงินแล้ว" ─────────────────────────────────────
  // ตั้ง CASHIER_DEP_CODES แล้ว = ใช้สัญญาณตรงจาก HosXP (cur_dep = ห้องการเงิน)
  //   → ตรงกับ flow ที่สุด เพราะทั้ง ER, ไม่มียา และ "ห้องยาส่งรายชื่อ"
  //     ล้วนจบด้วยการส่ง visit มาที่แผนกห้องการเงินเหมือนกัน
  // ไม่ตั้ง = เดาจากเวลาจุดบริการแทน (ดูหมายเหตุใน docs/OPD_FLOW.md)
  //   ไม่มียา → ตรวจเสร็จแล้ว (service12)
  //   มียา    → ถึงห้องยาแล้ว (service6) เพราะห้องยาจัดยาเสร็จจึงส่งรายชื่อมา
  let queueClause: string;
  if (depCodes.length > 0) {
    const ph = depCodes.map(() => "?").join(",");
    queueClause = `(q.cur_dep IN (${ph}) OR q.paid_money > 0)`;
    params.push(...depCodes);
  } else {
    queueClause = `(
         (q.has_drug = 0 AND q.after_doctor IS NOT NULL)
      OR (q.has_drug = 1 AND q.at_pharmacy  IS NOT NULL)
      OR q.paid_money > 0
    )`;
  }

  const sql = `
    SELECT q.* FROM (
      SELECT
        o.vn                                       AS vn,
        o.hn                                       AS hn,
        CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
        COALESCE(kl.department, km.department, '') AS dept_name,
        COALESCE(o.cur_dep, '')                    AS cur_dep,
        COALESCE(os.name, '')                      AS status_name,
        COALESCE(v.income, 0)                      AS income,
        COALESCE(v.paid_money, 0)                  AS paid_money,
        st.service12                               AS after_doctor,
        st.service6                                AS at_pharmacy,
        CASE WHEN st.service16 IS NOT NULL THEN 1 ELSE 0 END AS drug_received,
        CASE WHEN EXISTS (
               SELECT 1 FROM opitemrece oi
               INNER JOIN drugitems di ON di.icode = oi.icode
               WHERE oi.vn = o.vn
             ) THEN 1 ELSE 0 END                   AS has_drug,
        -- เวลาที่ถูกส่งมาห้องการเงิน: มียา = ถึงห้องยา, ไม่มียา = ตรวจเสร็จ,
        -- ไม่มี service_time (เช่น ER) = เวลาลงทะเบียน
        TIME_FORMAT(
          COALESCE(st.service6, st.service12, o.vsttime), '%H:%i'
        )                                          AS send_time
      FROM ovst o
      LEFT JOIN vn_stat       v  ON v.vn       = o.vn
      LEFT JOIN service_time  st ON st.vn      = o.vn
      LEFT JOIN patient       p  ON p.hn       = o.hn
      LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
      LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
      LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
      WHERE o.vstdate = ?
        AND o.an IS NULL          -- Admit = terminal ตาม flow ไม่เข้าคิวการเงิน
        AND COALESCE(v.income, 0) > 0
    ) q
    WHERE ${queueClause}
    ORDER BY q.send_time
  `;

  const [rows] = (await getDb().query(sql, params)) as unknown as [Row[], unknown];

  return rows.map((r) => {
    const income = num(r.income);
    const paid = num(r.paid_money);
    const status = toStatus(r, depCodes);
    const route: CashierRoute = num(r.has_drug) === 1 ? "มียา" : "ไม่มียา";
    return {
      id: clean(r.vn),
      vn: clean(r.vn),
      hn: clean(r.hn),
      name: clean(r.patient_name) || clean(r.hn),
      dept: clean(r.dept_name) || "ไม่ระบุแผนก",
      time: clean(r.send_time),
      status,
      route,
      nextStep: nextStepOf(status, route, num(r.drug_received) === 1),
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
      route: r.route,
      amount: r.amount,
    })),
    waiting: pending.length,
    done: data.rows.filter((r) => r.status === "ชำระแล้ว").length,
  };
}
