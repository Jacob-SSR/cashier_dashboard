-- ═══ คิวห้องการเงิน (cashier_dashboard) — SQL ที่แอปใช้จริง ═══
-- ต้นฉบับอยู่ใน lib/cashier.service.ts  ไฟล์นี้ไว้เปิดรันใน HeidiSQL/MySQL client
-- เพื่อ "ตรวจว่าข้อมูลออกถูก" ก่อน deploy
--
-- ⚠️ อ่าน docs/OPD_FLOW.md ก่อนแก้
--
-- ── หัวใจของ query: ใครต้องมาจ่ายเงินที่ห้องการเงิน ────────────────────────
-- opd_opi_finance_summary แยกยอดตาม pttype.paidst
--   01 ชำระเองเบิกได้     → คนไข้จ่ายเอง ★
--   02 ลูกหนี้สิทธิ        → เรียกเก็บจากกองทุน คนไข้ไม่จ่าย
--   03 ชำระเองเบิกไม่ได้  → คนไข้จ่ายเอง ★
--   04 ส่วนลดเงินสด
-- ยอดที่ต้องมาจ่าย = total_balance_01 + total_balance_03
-- ❌ ห้ามใช้ balance_amount เฉย ๆ (รวมลูกหนี้สิทธิ 02 ที่คนไข้ไม่ต้องจ่าย)
-- ❌ ห้ามใช้ vn_stat.remain_money (ตรวจแล้วเป็น 0 ทุก visit ใน รพ. นี้)


-- ── ข้อ 1) คิวห้องการเงินของวันนี้ (query เดียวกับที่แอปยิง) ───────────────
SELECT q.* FROM (
  SELECT
    o.vn                                       AS vn,
    o.hn                                       AS hn,
    o.oqueue                                   AS เลขคิว,
    CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS ชื่อ,
    COALESCE(kl.department, km.department, '') AS แผนกที่ส่ง,
    TIME_FORMAT(COALESCE(o.cur_dep_time, o.vsttime), '%H:%i') AS เวลาส่ง,
    COALESCE(fs.self_balance, 0)               AS ต้องจ่ายเอง,
    COALESCE(fs.self_paid, 0)                  AS จ่ายไปแล้ว,
    CASE WHEN EXISTS (
           SELECT 1 FROM opitemrece oi
           INNER JOIN drugitems di ON di.icode = oi.icode
           WHERE oi.vn = o.vn
         ) THEN 'มียา' ELSE 'ไม่มียา' END      AS เส้นทาง
  FROM ovst o
  LEFT JOIN (
    SELECT f.vn,
      SUM(COALESCE(f.total_balance_01,0) + COALESCE(f.total_balance_03,0)) AS self_balance,
      SUM(COALESCE(f.total_clear_01,0)   + COALESCE(f.total_clear_03,0))   AS self_paid
    FROM opd_opi_finance_summary f
    INNER JOIN ovst o2 ON o2.vn = f.vn AND o2.vstdate = CURDATE()
    GROUP BY f.vn
  ) fs ON fs.vn = o.vn
  LEFT JOIN patient       p  ON p.hn       = o.hn
  LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
  LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
  WHERE o.vstdate = CURDATE()
    AND o.an IS NULL
) q
WHERE q.ต้องจ่ายเอง > 0 OR q.จ่ายไปแล้ว > 0
ORDER BY CAST(q.เลขคิว AS UNSIGNED);


-- ── ข้อ 2) สรุปว่าวันนี้มีคนต้องจ่ายเงินกี่คน ─────────────────────────────
-- เอาไว้เทียบกับจำนวนคนที่ห้องการเงินรับจริง
SELECT
  COUNT(*)                                                     AS visit_มีบิล,
  SUM(CASE WHEN fs.self_balance > 0 THEN 1 ELSE 0 END)         AS ยังไม่จ่าย,
  SUM(CASE WHEN fs.self_balance <= 0 AND fs.self_paid > 0
           THEN 1 ELSE 0 END)                                  AS จ่ายแล้ว,
  SUM(fs.self_balance)                                         AS ยอดค้างรวม,
  SUM(fs.self_paid)                                            AS ยอดรับแล้วรวม
FROM ovst o
INNER JOIN (
  SELECT f.vn,
    SUM(COALESCE(f.total_balance_01,0) + COALESCE(f.total_balance_03,0)) AS self_balance,
    SUM(COALESCE(f.total_clear_01,0)   + COALESCE(f.total_clear_03,0))   AS self_paid
  FROM opd_opi_finance_summary f
  INNER JOIN ovst o2 ON o2.vn = f.vn AND o2.vstdate = CURDATE()
  GROUP BY f.vn
) fs ON fs.vn = o.vn
WHERE o.vstdate = CURDATE() AND o.an IS NULL;


-- ── ข้อ 3) เทียบ 3 วิธีคิดยอด ให้เห็นว่าทำไมต้องใช้ 01+03 ─────────────────
-- balance_amount รวมลูกหนี้สิทธิเข้ามาด้วย จะได้คนเกินจริง
SELECT
  COUNT(*)                                                       AS visit_มีบิล,
  SUM(CASE WHEN fs.bal_all  > 0 THEN 1 ELSE 0 END)               AS ใช้_balance_amount,
  SUM(CASE WHEN fs.bal_self > 0 THEN 1 ELSE 0 END)               AS ใช้_01บวก03_ถูกต้อง,
  SUM(CASE WHEN fs.bal_scheme > 0 AND fs.bal_self <= 0
           THEN 1 ELSE 0 END)                                    AS ลูกหนี้สิทธิล้วน_ไม่ต้องขึ้นจอ
FROM (
  SELECT f.vn,
    SUM(COALESCE(f.balance_amount,0))                                    AS bal_all,
    SUM(COALESCE(f.total_balance_01,0) + COALESCE(f.total_balance_03,0)) AS bal_self,
    SUM(COALESCE(f.total_balance_02,0))                                  AS bal_scheme
  FROM opd_opi_finance_summary f
  INNER JOIN ovst o2 ON o2.vn = f.vn AND o2.vstdate = CURDATE()
  GROUP BY f.vn
) fs;


-- ── ข้อ 4) ความหมายของ paidst (อ้างอิง) ───────────────────────────────────
SELECT pttype, paidst, name FROM pttype ORDER BY paidst, pttype;
--   00 ค้างชำระ · 01 ชำระเองเบิกได้ · 02 ลูกหนี้สิทธิ
--   03 ชำระเองเบิกไม่ได้ · 04 ส่วนลดเงินสด


-- ── ข้อ 5) เกณฑ์ที่ทำในโค้ด (ไม่ได้ทำใน SQL) ──────────────────────────────
--   รอชำระ    = ต้องจ่ายเอง > 0     → ขึ้นจอ
--   ชำระแล้ว  = ต้องจ่ายเอง = 0     → หลุดจากจอ
--   คนที่ถึงคิว = หัวแถวของเลขคิว oqueue (ไม่ได้เดาจากคอลัมน์สถานะใด ๆ)
--   ไปต่อหลังชำระ: มียา + ยังไม่รับยา (service_time.service16 ว่าง) → กลับไปรับยา
