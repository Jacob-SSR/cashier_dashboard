-- ═══════════════════════════════════════════════════════════════════════════
--  ตรวจคอลัมน์การเงิน + หาว่ามี "ตารางสถานะ" อะไรบ้าง
--  ที่มา: trace ที่ดักได้จากหน้าจอการเงินของ HOSxP เอง
--  (ทุกข้อเป็น SELECT อ่านอย่างเดียว)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ข้อ 1) vn_stat.remain_money มีจริงไหม + หน้าตาเป็นยังไง ────────────────
-- dashboard เปลี่ยนมาใช้คอลัมน์นี้เป็นตัวตัดสิน "ยังค้างชำระ" แล้ว
-- (เกณฑ์เดียวกับหน้าจอการเงินของ HOSxP)
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'vn_stat'
  AND COLUMN_NAME IN ('income','paid_money','rcpt_money','remain_money')
ORDER BY COLUMN_NAME;


-- ── ข้อ 2) เทียบ remain_money กับ income - paid_money ของวันนี้ ────────────
-- 👉 แถวที่ diff <> 0 คือคนที่ "สิทธิ์เบิกได้ ไม่ต้องจ่ายเอง"
--    ถ้ามีเยอะ = สาเหตุที่คิวเก่ากับคิวใหม่ไม่ตรง (ของเดิมผมคำนวณเอง คนกลุ่มนี้ค้างบนจอทั้งวัน)
SELECT
  COUNT(*)                                                        AS visits,
  SUM(CASE WHEN COALESCE(v.remain_money,0) > 0 THEN 1 ELSE 0 END) AS ยังค้างชำระ,
  SUM(CASE WHEN COALESCE(v.remain_money,0) <= 0
            AND COALESCE(v.income,0) - COALESCE(v.paid_money,0) > 0
           THEN 1 ELSE 0 END)                                     AS เบิกได้ไม่ต้องจ่าย
FROM ovst o
LEFT JOIN vn_stat v ON v.vn = o.vn
WHERE o.vstdate = CURDATE()
  AND o.an IS NULL
  AND COALESCE(v.income, 0) > 0;


-- ── ข้อ 3) มีตารางที่ชื่อเกี่ยวกับ "สถานะ" อะไรบ้าง ────────────────────────
SELECT TABLE_NAME, TABLE_ROWS, UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND (TABLE_NAME LIKE '%status%'
    OR TABLE_NAME LIKE '%ovstost%'
    OR TABLE_NAME LIKE '%_stat'
    OR TABLE_NAME LIKE '%finance%')
ORDER BY UPDATE_TIME DESC, TABLE_NAME;


-- ── ข้อ 4) ovstost = ตารางชื่อสถานะผู้ป่วย มีสถานะอะไรบ้าง ────────────────
-- ดูว่ามีสถานะที่แปลว่า "อยู่ห้องการเงิน / กำลังชำระ" ไหม
SELECT ovstost, name FROM ovstost ORDER BY ovstost;


-- ── ข้อ 5) pttype.paidst = สถานะการชำระของแต่ละสิทธิ ──────────────────────
-- จาก trace: HOSxP ดึงคอลัมน์นี้มาตอนเปิดหน้าจอการเงิน
-- น่าจะบอกว่าสิทธิ์นั้น "ต้องจ่ายเอง" หรือ "เบิกได้"
SELECT pttype, paidst, name FROM pttype ORDER BY paidst, pttype;


-- ── ข้อ 6) opd_opi_finance_summary หน้าตาเป็นยังไง ─────────────────────────
-- จาก trace: หน้าจอการเงินอ่านตารางนี้ (balance_amount / total_amount / income)
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'opd_opi_finance_summary'
ORDER BY ORDINAL_POSITION;

-- ตัวอย่างข้อมูลจริงของวันนี้
SELECT f.*
FROM opd_opi_finance_summary f
INNER JOIN ovst o ON o.vn = f.vn
WHERE o.vstdate = CURDATE()
LIMIT 20;
