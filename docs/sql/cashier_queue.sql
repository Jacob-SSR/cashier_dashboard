-- ═══ คิวห้องเก็บเงิน (cashier_dashboard) — SQL ที่แอปใช้จริง ═══
-- ต้นฉบับอยู่ใน lib/cashier.service.ts  ไฟล์นี้ไว้เปิดรันใน HeidiSQL/MySQL client
-- เพื่อ "ตรวจว่าข้อมูลออกถูก" ก่อนตั้งค่า .env.production
--
-- ตารางที่ใช้ (HOSxP):
--   ovst          visit OPD ของวัน — cur_dep = แผนกที่อยู่ตอนนี้, last_dep = แผนกก่อนหน้า
--   vn_stat       ยอดเงินของ visit — income = ยอดรวม, paid_money = จ่ายแล้ว
--   patient       ชื่อ-นามสกุล
--   kskdepartment ชื่อแผนก (depcode → department)
--   ovstost       ชื่อสถานะผู้ป่วย เช่น "รอชำระเงิน" / "รับยาแล้ว"

-- ── 1) หา "รหัสแผนกห้องเก็บเงิน" ของ รพ. เรา ────────────────────────────────
-- ได้ depcode แล้วเอาไปใส่ CASHIER_DEP_CODES ใน .env.production (คั่นด้วย comma)
SELECT depcode, department
FROM kskdepartment
WHERE department LIKE '%เก็บเงิน%'
   OR department LIKE '%การเงิน%'
   OR department LIKE '%ชำระ%'
ORDER BY depcode;

-- ── 2) ดูชื่อสถานะทั้งหมดที่ HOSxP ใช้จริง ─────────────────────────────────
-- ใช้ตรวจว่ามีสถานะที่มีคำว่า "กำลังชำระ" หรือไม่ (lib/cashier.service.ts ใช้คำนี้จับ)
SELECT ovstost, name FROM ovstost ORDER BY ovstost;

-- ── 3) คิวห้องเก็บเงินของวันนี้ (query เดียวกับที่แอปยิง) ───────────────────
-- แบบไม่ตั้ง CASHIER_DEP_CODES = เกณฑ์กลาง "visit ที่มียอดเงิน"
SELECT
  o.vn                                       AS vn,
  o.hn                                       AS hn,
  CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
  COALESCE(kl.department, km.department, '') AS dept_name,   -- แผนกที่ส่งมา
  TIME_FORMAT(o.vsttime, '%H:%i')            AS send_time,
  COALESCE(os.name, '')                      AS status_name,
  COALESCE(o.cur_dep, '')                    AS cur_dep,
  COALESCE(v.income, 0)                      AS income,       -- ยอดรวม
  COALESCE(v.paid_money, 0)                  AS paid_money    -- จ่ายแล้ว
FROM ovst o
LEFT JOIN vn_stat       v  ON v.vn       = o.vn
LEFT JOIN patient       p  ON p.hn       = o.hn
LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
WHERE o.vstdate = CURDATE()
  AND o.an IS NULL                -- เอาเฉพาะ OPD (คน admit ไปคิดเงินตอนจำหน่าย)
  AND COALESCE(v.income, 0) > 0
ORDER BY o.vsttime;

-- ── 3.1) แบบตั้ง CASHIER_DEP_CODES แล้ว (ตัวอย่าง depcode = '006') ─────────
-- แทนที่บรรทัด "AND COALESCE(v.income,0) > 0" ข้างบนด้วยเงื่อนไขนี้:
--   AND (o.cur_dep IN ('006') OR o.last_dep IN ('006') OR COALESCE(v.paid_money,0) > 0)

-- ── 4) เกณฑ์แปลงเป็นสถานะบนหน้าจอ (ทำในโค้ด ไม่ได้ทำใน SQL) ───────────────
--   ชำระแล้ว   = income > 0 AND paid_money >= income
--   กำลังชำระ  = ยังไม่ครบ และ (ชื่อสถานะมีคำว่า "กำลังชำระ" หรือ cur_dep = ห้องเก็บเงิน)
--   รอชำระ     = ที่เหลือ
-- ยอดที่โชว์: ชำระแล้ว → paid_money, ยังไม่ชำระ → income - paid_money

-- ── 5) ตรวจยอดรวมของวัน (ไว้กระทบยอดกับรายงานการเงิน) ─────────────────────
SELECT
  COUNT(*)                                    AS visits,
  SUM(COALESCE(v.income, 0))                  AS total_income,
  SUM(COALESCE(v.paid_money, 0))              AS total_paid,
  SUM(COALESCE(v.income,0) - COALESCE(v.paid_money,0)) AS outstanding
FROM ovst o
LEFT JOIN vn_stat v ON v.vn = o.vn
WHERE o.vstdate = CURDATE()
  AND o.an IS NULL;
