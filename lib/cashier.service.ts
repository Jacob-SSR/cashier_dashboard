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
//   ovst                     visit OPD ของวัน
//                            oqueue       = เลขคิวจริง (เลขเดียวกับจอคิวเดิมของ รพ.)
//                            cur_dep_time = เวลาที่เข้าแผนกปัจจุบัน
//                            an           = เลข admit
//   opd_opi_finance_summary  สรุปยอดการเงินต่อ visit ต่อหมวดรายได้ ★ ตัวหลัก
//   rx_operator              ★ pay='Y' = จ่ายเงินแล้ว (สัญญาณจริงที่ HOSxP ใช้เอง)
//   opitemrece + drugitems   ใช้ตัดสิน "มียา / ไม่มียา"
//   service_time             service16 = รับยาแล้วหรือยัง
//   patient / kskdepartment  ชื่อคนไข้ / ชื่อแผนก
//
// ── ยอดที่ "คนไข้ต้องจ่ายเอง" คิดยังไง ──────────────────────────────────────
// opd_opi_finance_summary แยกยอดตาม pttype.paidst
//   01 ชำระเองเบิกได้     → คนไข้จ่ายเอง ★
//   02 ลูกหนี้สิทธิ        → เรียกเก็บจากกองทุน คนไข้ไม่จ่าย
//   03 ชำระเองเบิกไม่ได้  → คนไข้จ่ายเอง ★
//   04 ส่วนลดเงินสด
// ดังนั้น "ยอดที่ต้องมาจ่ายที่ห้องการเงิน" = total_balance_01 + total_balance_03
// ห้ามใช้ balance_amount เฉย ๆ เพราะรวมลูกหนี้สิทธิ (02) ที่คนไข้ไม่ต้องจ่าย
// เข้ามาด้วย — จะได้คนขึ้นจอเกินจริง
//
// ⚠️ vn_stat.remain_money ใช้ไม่ได้กับ รพ. นี้ — ตรวจข้อมูลจริงแล้วเป็น 0 ทั้ง 264 visit
//    (เป็นช่องลูกหนี้ค้างชำระ ไม่ใช่ยอดที่ยังไม่ได้จ่ายของวัน)
import { getDb, isDbConfigured } from "@/lib/db";
import { demoRows } from "@/lib/cashier.demo";
import { maskSurname } from "@/lib/mask";
import { createHash } from "node:crypto";
import type {
  BoardData,
  BoardRow,
  CallData,
  CashierData,
  CashierRoute,
  CashierRow,
  CashierStatus,
} from "@/lib/cashier.types";

export type QueueSource = "selfpay" | "bill" | "charges" | "all";

/**
 * เกณฑ์ว่า "ใครควรขึ้นจอ" — ตั้งด้วย QUEUE_SOURCE
 *   "all"     (ค่าเริ่มต้น) = ผู้ป่วยนอกทุกคนของวันนี้ — ขึ้นชื่อแน่นอน ไม่มีทางจอว่าง
 *                             เหมาะกับตอนเริ่มใช้งาน ค่อยกรองให้แคบลงทีหลัง
 *   "charges"               = เฉพาะคนที่มีค่าใช้จ่ายวันนี้และยังไม่ปิดยอด
 *                             อ่านจาก opitemrece ซึ่งลงทันทีตอนสั่งยา/สั่งตรวจ = ข้อมูลสดแน่นอน
 *                             ปิดยอดแล้ว = ovst.finance_summary_date มีค่า
 *   "bill"                  = ทุกคนที่มีบิลใน opd_opi_finance_summary และยังไม่ถูกเคลียร์
 *   "selfpay"               = เฉพาะคนที่ต้องควักเงินจ่ายเอง (paidst 01 + 03)
 *
 * ⚠️ ถ้าเกณฑ์ที่เลือกไม่ได้คนเลย ระบบจะไล่ลองเกณฑ์ที่หลวมกว่าให้อัตโนมัติ
 *    (ดู SOURCE_FALLBACK) เพื่อไม่ให้จอทีวีว่างเปล่าทั้งที่มีคนไข้รออยู่จริง
 *    เปิด /api/queue/debug ดูได้ว่าสุดท้ายใช้เกณฑ์ไหน
 */
function queueSource(): QueueSource {
  const v = process.env.QUEUE_SOURCE;
  return v === "selfpay" || v === "bill" || v === "charges" || v === "all"
    ? v
    : "all";
}

/** ถ้าเกณฑ์ที่ตั้งไว้ไม่ได้คนเลย ให้ไล่ลองตัวถัดไปในลิสต์ */
const SOURCE_FALLBACK: Record<QueueSource, QueueSource[]> = {
  selfpay: ["selfpay", "bill", "charges", "all"],
  bill: ["bill", "charges", "all"],
  charges: ["charges", "all"],
  all: ["all"],
};

/**
 * ชื่อสถานะ (ovstost.name) ที่ถือว่าคนไข้ "ออกจากระบบแล้ว" → ไม่ต้องอยู่บนจอคิว
 * ยกตรรกะมาจาก lib/deptStatus.service.ts ของโปรเจกต์ ppc-hos-10667
 * แล้วปรับลิสต์ให้ตรงกับ ovstost จริงของ รพ. (ตรวจแล้วมี 28 สถานะ)
 *
 * ที่ตรงกับ รพ. นี้จริง ๆ: หนีกลับ · ปฏิเสธการรักษา · เสียชีวิต* · ตายที่แผนกผู้ป่วยนอก ·
 * ส่งต่อสถานพยาบาลอื่น · Admit แผนก* — คนกลุ่มนี้ไม่มีทางกลับมาจ่ายเงินแล้ว
 *
 * ⚠️ ใช้วิธี "มีคำนี้อยู่ในชื่อ" (includes) ห้ามใส่คำกว้างเกินไป
 *   - ห้ามใส่ "แล้ว" เด็ดขาด จะไป match "ตรวจแล้ว" ที่ยังต้องมาจ่ายเงิน
 *   - "หนีกลับ" กับ "กลับบ้าน" ไม่ match กันเอง จึงใส่ได้ทั้งคู่
 * ปรับเพิ่มได้ที่ env FINISHED_STATUS (คั่นด้วย comma)
 */
const FINISHED_STATUS_KEYWORDS = (
  process.env.FINISHED_STATUS ??
  [
    "หนีกลับ",
    "ปฏิเสธการรักษา",
    "เสียชีวิต",
    "ตายที่",
    "ถึงแก่กรรม",
    "dead",
    "ส่งต่อ",
    "refer",
    "Admit",
    "จำหน่าย",
    "รับยาแล้ว",
    "กลับบ้าน",
    "เสร็จสิ้น",
  ].join(",")
)
  .split(",")
  .map((k) => k.trim().toLowerCase())
  .filter(Boolean);

function isFinishedStatus(name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return FINISHED_STATUS_KEYWORDS.some((k) => n.includes(k));
}

/**
 * รหัสแผนกห้องเก็บเงิน (kskdepartment.depcode) — คั่นด้วย comma ใน env
 * ค่าเริ่มต้น 013 = "ห้องเก็บเงิน" ของโรงพยาบาลพลับพลาชัย (ยืนยันจาก kskdepartment)
 * ตั้ง CASHIER_DEP_CODES="" (ว่าง) เพื่อปิดตัวกรองนี้
 */
const CASHIER_DEP_DEFAULT = "013,077,078";

function cashierDepCodes(): string[] {
  const raw = process.env.CASHIER_DEP_CODES ?? CASHIER_DEP_DEFAULT;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Row {
  vn: string;
  hn: string;
  queue_no: number | string | null;
  patient_name: string;
  /** ชื่อสำหรับอ่านออกเสียง รูปแบบเดียวกับจอเดิม: คุณ<ชื่อ> <นามสกุล> */
  call_name: string;
  dept_name: string;
  send_time: string;
  /** ชื่อสถานะจาก ovstost — ใช้ตัดคนที่ออกจากระบบไปแล้วออกจากจอ */
  status_name: string;
  /** ลำดับความสำคัญของคนไข้ (ผู้สูงอายุ/พระ/ฉุกเฉิน) — มากกว่า = เรียกก่อน */
  pt_priority: number;
  /** ยอดที่คนไข้ต้องจ่ายเอง และยังไม่จ่าย (paidst 01 + 03) */
  self_balance: number;
  /** ยอดที่คนไข้จ่ายเองไปแล้ว (paidst 01 + 03) */
  self_paid: number;
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
 * ovst.oqueue เป็น integer (เช่น 39) — 0 หรือ NULL แปลว่า visit นั้นไม่ได้ออกเลขคิว
 * คืนสตริงว่างในกรณีนั้น จอจะได้ไม่ขึ้น "คิว 0"
 */
function toQueueNo(v: unknown): string {
  const n = num(v);
  return n > 0 ? String(n) : "";
}

/**
 * แปลงข้อมูลดิบ 1 แถวเป็นสถานะ — ดูที่ "ยอดที่คนไข้ต้องจ่ายเอง" อย่างเดียว
 *   รอชำระ   = ยังค้างจ่ายเอง (self_balance > 0)
 *   ชำระแล้ว = จ่ายครบแล้ว → หลุดจากจอ
 *
 * ไม่เดา "กำลังชำระ" จากคอลัมน์ไหนของ HOSxP เลย (ovstost ไม่มีสถานะห้องการเงิน,
 * finance_lock ความหมายไม่ชัด) — คนที่ "ถึงคิว" ใช้หัวแถวของ oqueue แทน
 */
function toStatus(r: Row): CashierStatus {
  return num(r.self_balance) > 0 ? "รอชำระ" : "ชำระแล้ว";
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
  const done = rows.filter((r) => r.status === "ชำระแล้ว").length;
  const outstanding = rows
    .filter((r) => r.status !== "ชำระแล้ว")
    .reduce((s, r) => s + r.amount, 0);
  return { wait, done, total: rows.length, outstanding };
}

/**
 * ชิ้นส่วน SQL ของแต่ละเกณฑ์ — join ตารางยอดเงิน + นิพจน์ "ยอดค้าง / ยอดที่ปิดแล้ว"
 * ทุกเกณฑ์จำกัดด้วย vstdate ตั้งแต่ใน join แล้ว ไม่ต้องสแกนตารางยอดทั้งก้อน
 */
function sourceSql(src: QueueSource): {
  join: string;
  balance: string;
  paid: string;
  /** จำนวน ? ของวันที่ที่ join ต้องการ "เพิ่ม" จากตัวแรก */
  extraDateParams?: number;
} {
  if (src === "all") {
    // ★ โหมดหลัก — ไม่แตะตารางการเงินเลย
    // หน้างานยืนยัน: เจ้าหน้าที่รับเงินเสร็จ → HOSxP ย้าย cur_dep ออกจาก 013
    // (ไป 029 กลับบ้าน หรือไปห้องยาถ้ามียา) = visit นั้นหลุดจาก WHERE cur_dep IN (013)
    // ของ query นี้ไปเอง จึงไม่ต้องมีสัญญาณ "จ่ายแล้ว" อะไรอีก
    // ใครยังอยู่ที่ 013 = ยังรอชำระ ทุกคน
    return { join: "", balance: "1", paid: "0", extraDateParams: -1 };
  }

  if (src === "charges") {
    // ยอดจาก opitemrece (ลงทันทีตอนสั่ง = สดที่สุด)
    // "เคลียร์แล้ว" เช็ค 2 ทาง เพราะ รพ. แต่ละที่ปิดยอดคนละแบบ
    return {
      join: `
      LEFT JOIN (
        SELECT oi.vn AS vn, SUM(COALESCE(oi.sum_price,0)) AS amt
        FROM opitemrece oi
        INNER JOIN ovst o2 ON o2.vn = oi.vn AND o2.vstdate = ?
        GROUP BY oi.vn
      ) fs ON fs.vn = o.vn
      LEFT JOIN (
        SELECT f.vn AS vn,
               SUM(COALESCE(f.balance_amount,0)) AS bal,
               SUM(COALESCE(f.clear_amount,0))   AS clr
        FROM opd_opi_finance_summary f
        INNER JOIN ovst o3 ON o3.vn = f.vn AND o3.vstdate = ?
        GROUP BY f.vn
      ) fc ON fc.vn = o.vn`,
      balance: `CASE
        WHEN o.finance_summary_date IS NOT NULL THEN 0
        WHEN fc.vn IS NOT NULL AND COALESCE(fc.bal,0) <= 0 THEN 0
        ELSE COALESCE(fs.amt,0) END`,
      paid: `CASE
        WHEN o.finance_summary_date IS NOT NULL THEN COALESCE(fs.amt,0)
        WHEN fc.vn IS NOT NULL AND COALESCE(fc.bal,0) <= 0 THEN COALESCE(fc.clr, fs.amt, 0)
        ELSE 0 END`,
      extraDateParams: 1,
    };
  }

  const sums =
    src === "selfpay"
      ? {
          // เฉพาะยอดที่คนไข้ควักจ่ายเอง (paidst 01 ชำระเองเบิกได้ + 03 ชำระเองเบิกไม่ได้)
          bal: "SUM(COALESCE(f.total_balance_01,0) + COALESCE(f.total_balance_03,0))",
          clr: "SUM(COALESCE(f.total_clear_01,0) + COALESCE(f.total_clear_03,0))",
        }
      : {
          // ทุกคนที่มีบิล (รวมลูกหนี้สิทธิ)
          bal: "SUM(COALESCE(f.balance_amount,0))",
          clr: "SUM(COALESCE(f.clear_amount,0))",
        };

  return {
    join: `
      LEFT JOIN (
        SELECT f.vn AS vn, ${sums.bal} AS bal, ${sums.clr} AS clr
        FROM opd_opi_finance_summary f
        INNER JOIN ovst o2 ON o2.vn = f.vn AND o2.vstdate = ?
        GROUP BY f.vn
      ) fs ON fs.vn = o.vn`,
    balance: "COALESCE(fs.bal,0)",
    paid: "COALESCE(fs.clr,0)",
  };
}

async function queryHosxp(
  date: string,
  src: QueueSource,
  useDepFilter = true,
): Promise<CashierRow[]> {
  const depCodes = useDepFilter ? cashierDepCodes() : [];
  const { join, balance, paid, extraDateParams = 0 } = sourceSql(src);

  // ? ของวันที่: หนึ่งตัวต่อ join ที่จำกัดวัน + อีกหนึ่งตัวสำหรับ WHERE ของ ovst
  // extraDateParams: -1 = join ไม่ใช้ ? เลย, 0 = ใช้ 1 ตัว, 1 = ใช้ 2 ตัว
  const joinDateParams = Math.max(0, extraDateParams + 1);

  // ★ ตัดคนที่ "ถูกเรียกไปแล้ว" ออกจากคิวรอ — ตรงกับ ajax/getScreeningW.php ของจอเดิม
  //   LEFT JOIN sd_queue_calling แล้วเก็บเฉพาะแถวที่ยังไม่เคยถูกเรียก
  //   (datetime IS NULL) หรือถูกส่งกลับเข้าห้องอีกครั้ง "หลัง" เวลาที่เรียก
  const calledJoin =
    depCodes.length > 0
      ? `LEFT JOIN sd_queue_calling sc
           ON sc.sd_queue_calling_vn     = o.vn
          AND sc.sd_queue_calling_queue  = o.oqueue
          AND sc.sd_queue_calling_curdep IN (${depCodes.map(() => "?").join(",")})`
      : "";
  const calledClause =
    depCodes.length > 0
      ? `AND (sc.sd_queue_calling_datetime IS NULL
             OR o.cur_dep_time >= TIME(sc.sd_queue_calling_datetime))`
      : "";

  // ลำดับ ? ต้องตรงกับลำดับที่โผล่ใน SQL: calledJoin → join(วันที่) → WHERE วันที่ → depClause
  const params: (string | number)[] = [
    ...(depCodes.length > 0 ? depCodes : []),
    ...Array.from({ length: joinDateParams }, () => date),
    date, // WHERE o.vstdate = ?
  ];

  // เอาเฉพาะคนที่ HosXP ส่งมาอยู่ที่ห้องเก็บเงินตอนนี้ (cur_dep = 013)
  // นี่คือนิยามที่ตรงที่สุดของ "คิวห้องเก็บเงิน" และทำให้ cur_dep_time
  // เป็น "เวลาที่ถูกส่งมาห้องเก็บเงิน" จริง ๆ
  let depClause = "";
  if (depCodes.length > 0) {
    depClause = `AND o.cur_dep IN (${depCodes.map(() => "?").join(",")})`;
    params.push(...depCodes);
  }

  // "all" = ไม่กรองด้วยเงินเลย ขอแค่มีชื่อขึ้นจอ
  const moneyClause =
    src === "all" ? "" : "WHERE q.self_balance > 0 OR q.self_paid > 0";

  const sql = `
    SELECT q.* FROM (
      SELECT
        o.vn                                       AS vn,
        o.hn                                       AS hn,
        o.oqueue                                   AS queue_no,
        CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
        CONCAT('คุณ', p.fname, ' ', p.lname)       AS call_name,
        COALESCE(kl.department, km.department, '') AS dept_name,
        COALESCE(os.name, '')                      AS status_name,
        COALESCE(o.pt_priority, 0)                 AS pt_priority,
        -- เวลาส่ง = เวลาที่ถูกส่งมาห้องเก็บเงิน
        -- cur_dep_time = เวลาที่เข้า "แผนกปัจจุบัน" → ตรงตามความหมายเมื่อคนไข้
        -- อยู่ที่ห้องเก็บเงินแล้ว (ตั้ง CASHIER_DEP_CODES เพื่อการันตีข้อนี้)
        -- ถ้ายังไม่ได้ตั้ง คนที่เดินไปแผนกอื่นต่อจะได้เวลาของแผนกนั้นแทน
        TIME_FORMAT(COALESCE(o.cur_dep_time, o.vsttime), '%H:%i') AS send_time,
        ${balance}                                 AS self_balance,
        ${paid}                                    AS self_paid,
        CASE WHEN st.service16 IS NOT NULL THEN 1 ELSE 0 END AS drug_received,
        CASE WHEN EXISTS (
               SELECT 1 FROM opitemrece oi2
               INNER JOIN drugitems di ON di.icode = oi2.icode
               WHERE oi2.vn = o.vn
             ) THEN 1 ELSE 0 END                   AS has_drug
      FROM ovst o
      ${calledJoin}${join}
      LEFT JOIN service_time  st ON st.vn      = o.vn
      LEFT JOIN patient       p  ON p.hn       = o.hn
      LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
      LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
      LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
      WHERE o.vstdate = ?
        ${calledClause}
        ${depClause}
    ) q
    ${moneyClause}
    ORDER BY q.send_time
  `;

  const [rows] = (await getDb().query(sql, params)) as unknown as [Row[], unknown];

  return rows
    .filter((r) => !isFinishedStatus(clean(r.status_name)))
    .map((r) => {
    const balanceAmt = num(r.self_balance);
    const paidAmt = num(r.self_paid);
    const status = toStatus(r);
    const route: CashierRoute = num(r.has_drug) === 1 ? "มียา" : "ไม่มียา";
    return {
      id: clean(r.vn),
      vn: clean(r.vn),
      hn: clean(r.hn),
      queueNo: toQueueNo(r.queue_no),
      priority: num(r.pt_priority),
      name: clean(r.patient_name) || clean(r.hn),
      callName: clean(r.call_name) || clean(r.patient_name),
      dept: clean(r.dept_name) || "ไม่ระบุแผนก",
      time: clean(r.send_time),
      status,
      route,
      nextStep: nextStepOf(status, route, num(r.drug_received) === 1),
      // ยังไม่จ่าย → โชว์ยอดที่ต้องจ่าย, จ่ายแล้ว → โชว์ยอดที่จ่ายไป
      amount: status === "ชำระแล้ว" ? paidAmt : balanceAmt,
    };
  });
}

/**
 * ยิงตามเกณฑ์ที่ตั้งไว้ ถ้าไม่ได้คนเลยค่อยไล่ลองเกณฑ์ที่หลวมกว่า
 * — จอทีวีไม่มีคนดูแล ว่างเปล่าทั้งที่มีคนไข้รออยู่คือสิ่งที่แย่ที่สุด
 */
async function queryWithFallback(
  date: string,
): Promise<{ rows: CashierRow[]; used: QueueSource }> {
  const chain = SOURCE_FALLBACK[queueSource()];
  let lastErr: unknown = null;

  for (const src of chain) {
    try {
      const rows = await queryHosxp(date, src);
      if (rows.length > 0) return { rows, used: src };
      // ⚠️ ห้ามถอยไป "ไม่กรองแผนก" เด็ดขาด — เคยทำแล้วพัง:
      //    ตอนเช้ายังไม่มีใครถึงห้องเก็บเงิน (ซึ่งถูกต้อง) แต่ระบบดันเอาคนที่เพิ่ง
      //    ลงทะเบียนที่ห้องบัตรทั้ง 109 คนมาขึ้นจอว่า "รอชำระ" ทั้งที่ยังไม่ได้พบแพทย์
      //    จอว่างตอนเช้า = ถูกต้อง ให้แสดงข้อความ "ยังไม่มีคิว" แทน
    } catch (err) {
      // เกณฑ์นี้ใช้ไม่ได้กับ HOSxP รุ่นนี้ (ไม่มีตาราง/คอลัมน์) → ลองตัวถัดไป
      console.error(`[cashier] queueSource=${src} ใช้ไม่ได้:`, err);
      lastErr = err;
    }
  }

  if (lastErr) throw lastErr;
  return { rows: [], used: chain[chain.length - 1] };
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

  const { rows } = await queryWithFallback(d);
  return {
    updatedAt: new Date().toISOString(),
    date: d,
    source: "hosxp",
    rows,
    summary: buildSummary(rows),
  };
}

// ─── จอคิว (จอสาธารณะให้คนไข้ดู) ────────────────────────────────────────────
// ทุกจอในระบบนี้คนไข้เป็นคนดู เจ้าหน้าที่ทำงานใน HOSxP ตามปกติ ไม่มีอะไรให้กดที่นี่
// จอจึงต้อง:
//   1) ไม่ส่ง VN/HN ออกไปเลย และปิดบังนามสกุล
//   2) เอาเฉพาะคนที่ยังไม่ชำระ เรียง "กำลังชำระ" ขึ้นก่อน แล้วตามเวลาที่ถูกส่งมา
//      → พอคนหน้าจ่ายครบก็หลุดจากจอ คนถัดไปเลื่อนขึ้นมาเอง
//   3) ชี้ว่าใคร "ถึงคิว" (หัวแถว) เพื่อไฮไลต์ + ใช้ประกาศเรียกชื่ออัตโนมัติ
const BOARD_ROWS_DEFAULT = 5;
const BOARD_ROWS_PER_COLUMN_DEFAULT = 5;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** จำนวนคิวทั้งหมดบนจอ */
export function boardRowLimit(): number {
  return positiveInt(process.env.BOARD_ROWS ?? process.env.TV_ROWS, BOARD_ROWS_DEFAULT);
}

/** จำนวนคิวต่อ 1 ช่อง — 10 คิว ÷ ช่องละ 5 = 2 ช่อง */
export function boardRowsPerColumn(): number {
  return positiveInt(
    process.env.BOARD_ROWS_PER_COLUMN ?? process.env.TV_ROWS_PER_COLUMN,
    BOARD_ROWS_PER_COLUMN_DEFAULT,
  );
}

/**
 * key สำหรับให้ฝั่งจอเทียบว่า "คนที่ถึงคิวเปลี่ยนไปหรือยัง"
 * hash ทิ้งไว้เพราะ VN ไม่ควรออกจาก server แม้จะไม่ได้เอาไปแสดง
 */
function rowKey(vn: string): string {
  return createHash("sha256").update(vn).digest("hex").slice(0, 12);
}

/**
 * เทียบเลขคิว — ovst.oqueue ของ รพ. เป็น integer จึงเทียบเป็นตัวเลขตรง ๆ (9 มาก่อน 10)
 * เผื่อไว้ให้ localeCompare แบบ numeric ด้วย เผื่อ รพ. อื่นใช้เลขคิวที่มีตัวอักษร (A012)
 */
function compareQueueNo(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1; // ไม่มีเลขคิว → ไปท้ายแถว
  if (!b) return -1;

  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;

  return a.localeCompare(b, "th", { numeric: true, sensitivity: "base" });
}

/**
 * ตาข่ายกันเหนียวเท่านั้น — สัญญาณหลักคือ cur_dep ย้ายออกจากห้องเก็บเงิน
 * ซึ่งเชื่อถือได้อยู่แล้ว ตัวนี้ไว้กันกรณีเจ้าหน้าที่ลืมกดปิดใน HOSxP
 * ตั้งไว้ยาว (4 ชม.) จะได้ไม่ไปตัดคนที่รอจริง — ตั้ง 0 เพื่อปิดการกันนี้
 */
// จอเดิมไม่มีตัวตัดเวลาเลย และตอนนี้ sd_queue_calling ตัดคนที่ถูกเรียกไปแล้วให้อยู่แล้ว
// จึงปิดเป็นค่าเริ่มต้น — ตั้ง QUEUE_MAX_AGE_MINUTES=240 ถ้าอยากเปิดตาข่ายกันเหนียว
const MAX_AGE_DEFAULT = 0;

function queueMaxAgeMinutes(): number {
  const n = Number(process.env.QUEUE_MAX_AGE_MINUTES ?? MAX_AGE_DEFAULT);
  return Number.isFinite(n) && n >= 0 ? n : MAX_AGE_DEFAULT;
}

/** ตอนนี้เป็นนาทีที่เท่าไหร่ของวัน (เวลาไทย) */
function minutesNowBangkok(): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: process.env.TZ || "Asia/Bangkok",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM" → นาทีของวัน (คืน null ถ้าไม่มีเวลา) */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * คิวที่ยังไม่ชำระ เรียงตาม "เวลาที่ถูกส่งมาห้องเก็บเงิน" (มาก่อนได้ก่อน)
 *
 * ★ ยืนยันจากการถ่ายรูปจอเดิมเทียบกับจอใหม่ในเวลาเดียวกัน (2 ก.ย. 11:20)
 *   จอเดิมเรียง: สำเรียง(10:14) → … → ถาวร(11:15) → เดชธนา(11:18) → นพรัตน์(11:19)
 *   = เรียงตามเวลาล้วน ไม่ใช่เลขคิว (นพรัตน์ oqueue=64 น้อยกว่า ถาวร=86 แต่อยู่ท้ายกว่า)
 *   เลขคิว oqueue ยังโชว์อยู่ แต่ไม่ได้ใช้จัดลำดับ (ใช้แค่ตัดสินตอนเวลาซ้ำกัน)
 */
function pendingQueue(rows: CashierRow[]): CashierRow[] {
  const maxAge = queueMaxAgeMinutes();
  const now = minutesNowBangkok();

  return rows
    .filter((r) => r.status !== "ชำระแล้ว")
    .filter((r) => {
      if (maxAge <= 0) return true;
      const t = toMinutes(r.time);
      if (t == null) return true; // ไม่มีเวลา = ไม่ตัดทิ้ง
      const age = now - t;
      // age ติดลบ = เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน/ข้ามเที่ยงคืน) ไม่ตัดทิ้ง
      return age < 0 || age <= maxAge;
    })
    // จอเดิมใช้ ORDER BY o.cur_dep_time ASC ล้วน ๆ (pt_priority เอาไว้ทำสีจุด ไม่ได้ใช้เรียง)
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) || compareQueueNo(a.queueNo, b.queueNo),
    );
}

/**
 * นับ "เรียกไปแล้ววันนี้" จาก sd_queue_calling
 * = จำนวนคนที่ห้องเก็บเงินกดเรียกไปแล้วในวันนั้น (หนึ่งคนนับครั้งเดียว)
 */
async function countDoneToday(date: string): Promise<number> {
  const depCodes = cashierDepCodes();
  if (depCodes.length === 0) return 0;

  try {
    const [rows] = (await getDb().query(
      `SELECT COUNT(DISTINCT sc.sd_queue_calling_vn) AS n
       FROM sd_queue_calling sc
       WHERE DATE(sc.sd_queue_calling_datetime) = ?
         AND sc.sd_queue_calling_curdep IN (${depCodes.map(() => "?").join(",")})`,
      [date, ...depCodes],
    )) as unknown as [{ n: number }[], unknown];
    return num(rows?.[0]?.n);
  } catch (err) {
    console.error("[cashier] countDoneToday failed:", err);
    return 0;
  }
}

/**
 * ★ "เรียกคิว" — คนที่ห้องเก็บเงินกดเรียกล่าสุด (จอเดิมโชว์ 2 คน)
 *
 * ยกมาจาก ajax/getDoctorRoomQ.php ของจอเดิมตรง ๆ:
 *   FROM sd_queue_calling sq
 *   INNER JOIN ovst o ON sq.sd_queue_calling_vn = o.vn
 *   WHERE sq.sd_queue_calling_curdep IN (…)
 *   ORDER BY sq.sd_queue_calling_datetime DESC LIMIT 2
 *
 * ต่างจากของเดิม 1 จุด: เพิ่ม DATE(...) = วันนี้
 * ของเดิมลืมใส่เฉพาะไฟล์นี้ (getMedicineQ.php / getScreeningQ.php ใส่ไว้)
 * ทำให้เช้าวันใหม่ยังค้างชื่อคนของเมื่อวานอยู่บนจอจนกว่าจะมีคนถูกเรียกคนแรก
 *
 * ⚠️ ไม่เขียนกลับ HOSxP — จอเดิมจะ UPDATE sd_queue_calling_status='N'
 *    หลังประกาศเสียง ถ้าจอนี้ไปเขียนด้วยจะแย่งกันกับจอเดิม
 *    จอนี้จึงดูแค่ว่า "แถวล่าสุดเปลี่ยนไหม" แล้วประกาศเอง (อ่านอย่างเดียว)
 */
async function queryCalled(date: string, limit: number): Promise<CashierRow[]> {
  const depCodes = cashierDepCodes();
  if (depCodes.length === 0) return [];

  const sql = `
    SELECT
      o.vn                                       AS vn,
      o.hn                                       AS hn,
      o.oqueue                                   AS queue_no,
      CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
      -- ชื่อที่ใช้ "อ่านออกเสียง" — จอเดิมใช้ CONCAT('คุณ', fname, ' ', lname)
      -- ไม่มีคำนำหน้า (นาย/นาง/ด.ช.) เพราะอ่านแล้วยาวและไม่เป็นธรรมชาติ
      CONCAT('คุณ', p.fname, ' ', p.lname)       AS call_name,
      d.department                               AS dept_name,
      ''                                         AS status_name,
      COALESCE(o.pt_priority, 0)                 AS pt_priority,
      TIME_FORMAT(sc.sd_queue_calling_datetime, '%H:%i') AS send_time,
      0 AS self_balance, 0 AS self_paid, 0 AS drug_received, 0 AS has_drug
    FROM sd_queue_calling sc
    INNER JOIN ovst          o ON o.vn      = sc.sd_queue_calling_vn
    INNER JOIN kskdepartment d ON d.depcode = sc.sd_queue_calling_curdep
    LEFT  JOIN patient       p ON p.hn      = o.hn
    WHERE sc.sd_queue_calling_curdep IN (${depCodes.map(() => "?").join(",")})
      AND DATE(sc.sd_queue_calling_datetime) = ?
    ORDER BY sc.sd_queue_calling_datetime DESC
    LIMIT ${Math.max(1, Math.min(10, Math.trunc(limit)))}
  `;

  const [rows] = (await getDb().query(sql, [...depCodes, date])) as unknown as [
    Row[],
    unknown,
  ];

  return rows.map((r) => ({
    id: clean(r.vn),
    vn: clean(r.vn),
    hn: clean(r.hn),
    queueNo: toQueueNo(r.queue_no),
    priority: num(r.pt_priority),
    name: clean(r.patient_name) || clean(r.hn),
    callName: clean(r.call_name) || clean(r.patient_name),
    dept: clean(r.dept_name) || "ห้องเก็บเงิน",
    time: clean(r.send_time),
    status: "รอชำระ" as CashierStatus,
    route: "ไม่มียา" as CashierRoute,
    nextStep: "",
    amount: 0,
  }));
}

/** จำนวนคนในส่วน "เรียกคิว" — จอเดิมโชว์ 2 คน */
/**
 * จำนวนแถวที่ดึงจาก sd_queue_calling
 * แถวแรก = คนที่กำลังเรียกอยู่ ที่เหลือไปอยู่กล่อง "ผู้ที่เรียกไปแล้ว" ด้านขวา
 * ตั้งได้ด้วย CALLED_ROWS (1 + จำนวนที่อยากโชว์ในกล่องขวา)
 */
function callingRows(): number {
  return positiveInt(process.env.CALLED_ROWS, 5) + 1;
}

function toBoardRow(r: CashierRow, i: number, isCalling: boolean): BoardRow {
  return {
    id: String(i + 1),
    queueNo: r.queueNo,
    name: maskSurname(r.name),
    dept: r.dept,
    time: r.time,
    route: r.route,
    amount: r.amount,
    isCalling,
  };
}

export async function getBoardQueue(date?: string): Promise<BoardData> {
  const data = await getCashierQueue(date);
  const pending = pendingQueue(data.rows);

  // "คิวรอ" = คนที่ยังไม่ถูกเรียก (sd_queue_calling ตัดคนที่เรียกไปแล้วออกใน SQL แล้ว)
  const rows: BoardRow[] = pending
    .slice(0, boardRowLimit())
    .map((r, i) => toBoardRow(r, i, false));

  // "เรียกคิว" = คนที่ห้องเก็บเงินกดเรียกล่าสุด — คนละชุดกับคิวรอ ไม่ทับกัน
  const calledRows =
    data.source === "demo"
      ? // โหมดสาธิตไม่มี sd_queue_calling จึงจำลองจากคนที่ "ชำระแล้ว"
        // เอาคนท้ายสุดของกลุ่มที่จ่ายไปแล้ว = คนที่เพิ่งถูกเรียกล่าสุด
        // แล้วกลับลำดับให้ใหม่สุดอยู่บน เลขคิวจะได้ต่อเนื่องกับ "คิวถัดไป"
        // (ถ้าหยิบแถวแรกของทั้งชุด เลขคิวจะกระโดดจนดูเหมือนบั๊ก)
        data.rows
          .filter((r) => r.status === "ชำระแล้ว")
          .slice(-callingRows())
          .reverse()
          .map((r) => ({ ...r, dept: "ห้องเก็บเงิน" }))
      : await queryCalled(data.date, callingRows()).catch((err) => {
          console.error("[cashier] queryCalled failed:", err);
          return [] as CashierRow[];
        });

  const called: BoardRow[] = calledRows.map((r, i) => toBoardRow(r, i, i === 0));

  return {
    updatedAt: data.updatedAt,
    date: data.date,
    source: data.source,
    rows,
    called,
    waiting: pending.length,
    done:
      data.source === "demo"
        ? data.rows.filter((r) => r.status === "ชำระแล้ว").length
        : await countDoneToday(data.date),
  };
}

/**
 * คนที่ถึงคิวตอนนี้ — ใช้ประกาศเรียกชื่ออัตโนมัติ (TTS)
 * ใช้ "ชื่อเต็ม" เพราะต้องอ่านออกเสียง (ชื่อถูกประกาศดัง ๆ อยู่แล้ว)
 * แต่ยังไม่ส่ง VN/HN ออกไป
 */
export async function getCallQueue(date?: string): Promise<CallData> {
  const d = date || todayInBangkok();

  if (!isDbConfigured()) {
    const rows = demoRows();
    const head = rows[0];
    return {
      updatedAt: new Date().toISOString(),
      calling: head
        ? {
            key: rowKey(head.vn),
            queueNo: head.queueNo,
            name: head.name,
            callName: head.callName,
            dept: head.dept,
            amount: head.amount,
          }
        : null,
      waiting: pendingQueue(rows).length,
    };
  }

  // ประกาศตาม sd_queue_calling — เจ้าหน้าที่กด "เรียกคิว" ใน HOSxP เมื่อไหร่
  // แถวใหม่โผล่ จอก็ประกาศตาม (ไม่ได้เดาเองจากหัวแถวคิวรออีกต่อไป)
  const [called, data] = await Promise.all([
    queryCalled(d, 1).catch(() => [] as CashierRow[]),
    getCashierQueue(d),
  ]);
  const head = called[0];

  return {
    updatedAt: data.updatedAt,
    calling: head
      ? {
          // key เปลี่ยนตามเวลาที่ถูกเรียก → เรียกซ้ำคนเดิมก็ประกาศใหม่ได้
          key: rowKey(`${head.vn}@${head.time}`),
          queueNo: head.queueNo,
          name: head.name,
          callName: head.callName,
          dept: head.dept,
          amount: head.amount,
        }
      : null,
    waiting: pendingQueue(data.rows).length,
  };
}

// ─── ตัวช่วยหาสาเหตุ "ทำไมจอว่าง" ────────────────────────────────────────────
// เปิด /api/queue/debug บนเครื่องที่ต่อ HOSxP แล้วดูว่าตัวเลขหายตรงขั้นไหน
export interface QueueDebug {
  date: string;
  queueSource: string;
  /** เกณฑ์ที่ถูกใช้จริงหลัง fallback */
  queueSourceUsed: string;
  cashierDepCodes: string[];
  counts: Record<string, number>;
  hint: string;
}

export async function getQueueDebug(date?: string): Promise<QueueDebug> {
  const d = date || todayInBangkok();
  const db = getDb();

  const one = async (sql: string, params: unknown[] = []): Promise<number> => {
    try {
      const [rows] = (await db.query(sql, params)) as unknown as [
        { n: number }[],
        unknown,
      ];
      return num(rows?.[0]?.n);
    } catch {
      return -1; // -1 = query ล้ม (เช่น ไม่มีตาราง/คอลัมน์นั้น)
    }
  };

  const counts: Record<string, number> = {};

  counts["1_visit_วันนี้ทั้งหมด"] = await one(
    "SELECT COUNT(*) AS n FROM ovst WHERE vstdate = ?",
    [d],
  );
  counts["2_ตัด_admit_ออก"] = await one(
    "SELECT COUNT(*) AS n FROM ovst WHERE vstdate = ? AND an IS NULL",
    [d],
  );
  counts["3_มีแถวใน_finance_summary"] = await one(
    `SELECT COUNT(DISTINCT f.vn) AS n
     FROM opd_opi_finance_summary f
     INNER JOIN ovst o ON o.vn = f.vn AND o.vstdate = ? AND o.an IS NULL`,
    [d],
  );
  counts["4a_bill_ยังไม่เคลียร์"] = await one(
    `SELECT COUNT(*) AS n FROM (
       SELECT f.vn FROM opd_opi_finance_summary f
       INNER JOIN ovst o ON o.vn = f.vn AND o.vstdate = ? AND o.an IS NULL
       GROUP BY f.vn HAVING SUM(COALESCE(f.balance_amount,0)) > 0
     ) t`,
    [d],
  );
  counts["4b_bill_เคลียร์แล้ว"] = await one(
    `SELECT COUNT(*) AS n FROM (
       SELECT f.vn FROM opd_opi_finance_summary f
       INNER JOIN ovst o ON o.vn = f.vn AND o.vstdate = ? AND o.an IS NULL
       GROUP BY f.vn HAVING SUM(COALESCE(f.clear_amount,0)) > 0
     ) t`,
    [d],
  );
  counts["5a_selfpay_ยังไม่จ่าย"] = await one(
    `SELECT COUNT(*) AS n FROM (
       SELECT f.vn FROM opd_opi_finance_summary f
       INNER JOIN ovst o ON o.vn = f.vn AND o.vstdate = ? AND o.an IS NULL
       GROUP BY f.vn
       HAVING SUM(COALESCE(f.total_balance_01,0) + COALESCE(f.total_balance_03,0)) > 0
     ) t`,
    [d],
  );
  counts["5b_selfpay_จ่ายแล้ว"] = await one(
    `SELECT COUNT(*) AS n FROM (
       SELECT f.vn FROM opd_opi_finance_summary f
       INNER JOIN ovst o ON o.vn = f.vn AND o.vstdate = ? AND o.an IS NULL
       GROUP BY f.vn
       HAVING SUM(COALESCE(f.total_clear_01,0) + COALESCE(f.total_clear_03,0)) > 0
     ) t`,
    [d],
  );
  counts["5c_all_ยังไม่ปิดยอด"] = await one(
    `SELECT COUNT(*) AS n FROM ovst
     WHERE vstdate = ? AND an IS NULL AND finance_summary_date IS NULL`,
    [d],
  );
  const dep = cashierDepCodes();
  if (dep.length > 0) {
    counts["5d_อยู่ห้องเก็บเงินตอนนี้"] = await one(
      `SELECT COUNT(*) AS n FROM ovst
       WHERE vstdate = ? AND an IS NULL
         AND cur_dep IN (${dep.map(() => "?").join(",")})`,
      [d, ...dep],
    );
  }
  counts["5e_ตัดออกเพราะสถานะ"] = await one(
    `SELECT COUNT(*) AS n FROM ovst o
     LEFT JOIN ovstost os ON os.ovstost = o.ovstost
     WHERE o.vstdate = ? AND o.an IS NULL
       AND ${
         dep.length > 0 ? `o.cur_dep IN (${dep.map(() => "?").join(",")}) AND` : ""
       } (${FINISHED_STATUS_KEYWORDS.map(() => "LOWER(COALESCE(os.name,'')) LIKE ?").join(" OR ")})`,
    [
      d,
      ...(dep.length > 0 ? dep : []),
      ...FINISHED_STATUS_KEYWORDS.map((k) => `%${k}%`),
    ],
  );
  counts["6_มีเลขคิว_oqueue"] = await one(
    "SELECT COUNT(*) AS n FROM ovst WHERE vstdate = ? AND an IS NULL AND COALESCE(oqueue,0) > 0",
    [d],
  );
  const picked = await queryWithFallback(d);
  counts["7_ที่จอเห็นตอนนี้"] = picked.rows.length;

  // เดาสาเหตุให้เลย จะได้ไม่ต้องมานั่งไล่เอง
  let hint: string;
  if (counts["1_visit_วันนี้ทั้งหมด"] === 0)
    hint =
      "วันนี้ยังไม่มี visit เลย — เช็ควันที่/TZ ของเครื่อง (ต้องเป็น Asia/Bangkok) หรือยังไม่มีคนไข้";
  else if (counts["2_ตัด_admit_ออก"] === 0)
    hint = "ทุก visit วันนี้เป็น Admit หมด (an ไม่เป็น NULL) — ผิดปกติ ส่งผลนี้มาให้ดู";
  else if (counts["7_ที่จอเห็นตอนนี้"] === 0 && cashierDepCodes().length > 0)
    hint =
      "มีคนไข้แต่จอไม่เห็น — ลบ CASHIER_DEP_CODES ออกจาก .env.production แล้ว restart";
  else if (counts["7_ที่จอเห็นตอนนี้"] === 0)
    hint = "มีคนไข้แต่จอไม่เห็น — ส่งผลนี้มาให้ดู";
  else
    hint = `ปกติ — จอเห็น ${counts["7_ที่จอเห็นตอนนี้"]} คน ด้วยเกณฑ์ ${picked.used}`;

  return {
    date: d,
    queueSource: queueSource(),
    queueSourceUsed: picked.used,
    cashierDepCodes: cashierDepCodes(),
    counts,
    hint,
  };
}
