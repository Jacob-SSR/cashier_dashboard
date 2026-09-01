-- ═══ คิวห้องการเงิน (cashier_dashboard) — SQL ที่แอปใช้จริง ═══
-- ต้นฉบับอยู่ใน lib/cashier.service.ts  ไฟล์นี้ไว้เปิดรันใน HeidiSQL/MySQL client
-- เพื่อ "ตรวจว่าข้อมูลออกถูก" ก่อนตั้งค่า .env.production
--
-- ⚠️ query ยึดตาม flow ผู้ป่วยนอก — อ่าน docs/OPD_FLOW.md ก่อนแก้
--    สรุปสั้น ๆ: Admit = จบ ไม่เข้าคิว / คนมียาเข้าคิวหลังผ่านห้องยา /
--    เอาเฉพาะคนที่ "ถูกส่งมาห้องการเงินแล้ว" ไม่ใช่ทุก visit ที่มีค่าใช้จ่าย
--
-- ตารางที่ใช้ (HOSxP):
--   ovst          visit OPD ของวัน — cur_dep = แผนกที่อยู่ตอนนี้, an = เลข admit
--   service_time  เวลาแต่ละจุดบริการ — service12 ตรวจเสร็จ, service6 ถึงห้องยา,
--                 service16 รับยาแล้ว
--   opitemrece + drugitems  ใช้ตัดสิน "มียา / ไม่มียา"
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

-- ── 3) คิวห้องการเงินของวันนี้ (query เดียวกับที่แอปยิง) ───────────────────
-- แบบตั้ง CASHIER_DEP_CODES แล้ว — เปลี่ยน '006' เป็น depcode จริงจากข้อ 1
SELECT q.* FROM (
  SELECT
    o.vn                                       AS vn,
    o.hn                                       AS hn,
    CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
    COALESCE(kl.department, km.department, '') AS dept_name,   -- แผนกที่ส่งมา
    COALESCE(o.cur_dep, '')                    AS cur_dep,
    COALESCE(os.name, '')                      AS status_name,
    COALESCE(v.income, 0)                      AS income,      -- ยอดรวม
    COALESCE(v.paid_money, 0)                  AS paid_money,  -- จ่ายแล้ว
    st.service12                               AS after_doctor,  -- ตรวจเสร็จ
    st.service6                                AS at_pharmacy,   -- ถึงห้องยา
    CASE WHEN st.service16 IS NOT NULL THEN 1 ELSE 0 END AS drug_received,
    CASE WHEN EXISTS (
           SELECT 1 FROM opitemrece oi
           INNER JOIN drugitems di ON di.icode = oi.icode
           WHERE oi.vn = o.vn
         ) THEN 1 ELSE 0 END                   AS has_drug,
    -- เวลาส่งมาห้องการเงิน: มียา = ถึงห้องยา, ไม่มียา = ตรวจเสร็จ, ER = เวลาลงทะเบียน
    TIME_FORMAT(COALESCE(st.service6, st.service12, o.vsttime), '%H:%i') AS send_time
  FROM ovst o
  LEFT JOIN vn_stat       v  ON v.vn       = o.vn
  LEFT JOIN service_time  st ON st.vn      = o.vn
  LEFT JOIN patient       p  ON p.hn       = o.hn
  LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
  LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
  LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
  WHERE o.vstdate = CURDATE()
    AND o.an IS NULL                -- Admit = terminal ตาม flow ไม่เข้าคิวการเงิน
    AND COALESCE(v.income, 0) > 0
) q
WHERE q.cur_dep IN ('006') OR q.paid_money > 0
ORDER BY q.send_time;

-- ── 3.1) แบบยังไม่รู้ depcode (fallback ที่แอปใช้ถ้าไม่ตั้ง CASHIER_DEP_CODES) ──
-- เปลี่ยนบรรทัด WHERE ท้ายสุดของข้อ 3 เป็น:
--   WHERE (q.has_drug = 0 AND q.after_doctor IS NOT NULL)  -- ไม่มียา: ตรวจเสร็จ
--      OR (q.has_drug = 1 AND q.at_pharmacy  IS NOT NULL)  -- มียา: ถึงห้องยาแล้ว
--      OR q.paid_money > 0

-- ── 4) เกณฑ์แปลงเป็นสถานะ/เส้นทาง (ทำในโค้ด ไม่ได้ทำใน SQL) ───────────────
--   ชำระแล้ว   = income > 0 AND paid_money >= income
--   กำลังชำระ  = ยังไม่ครบ และ (ชื่อสถานะมีคำว่า "กำลังชำระ" หรือ cur_dep = ห้องการเงิน)
--   รอชำระ     = ที่เหลือ
--   ยอดที่โชว์  = ชำระแล้ว → paid_money, ยังไม่ชำระ → income - paid_money
--   ไปต่อหลังชำระ (ตาม flow):
--     has_drug = 0                      → กลับบ้าน
--     has_drug = 1 AND drug_received = 0 → กลับไปรับยาที่ห้องยา
--     has_drug = 1 AND drug_received = 1 → กลับบ้าน

-- ── 4.1) เช็กว่าใครยังไม่ถูกส่งมาการเงิน (ควร "ไม่" อยู่ในข้อ 3) ────────────
-- ใช้ยืนยันว่า query ไม่ได้ดึงคนที่ยังอยู่หน้าห้องตรวจ/กำลังพบแพทย์มาด้วย
SELECT o.vn, o.hn, COALESCE(os.name,'') AS status_name,
       COALESCE(k.department,'') AS cur_dep_name,
       st.service12 AS after_doctor, st.service6 AS at_pharmacy
FROM ovst o
LEFT JOIN service_time  st ON st.vn      = o.vn
LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
LEFT JOIN kskdepartment k  ON k.depcode  = o.cur_dep
WHERE o.vstdate = CURDATE()
  AND o.an IS NULL
  AND st.service12 IS NULL          -- ยังตรวจไม่เสร็จ = ยังไม่ถึงคิวการเงิน
ORDER BY o.vsttime;

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
