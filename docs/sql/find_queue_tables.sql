-- ═══════════════════════════════════════════════════════════════════════════
--  หาว่า "คิวเก่า" ของห้องการเงินอ่านจากตารางไหน
--  รันทีละข้อใน HeidiSQL / MySQL Workbench แล้วส่งผลลัพธ์กลับมา
--  (ทุกข้อเป็น SELECT อ่านอย่างเดียว ไม่แก้ไขข้อมูลใด ๆ)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ข้อ 1) มีตารางอะไรที่ชื่อเกี่ยวกับ "คิว" บ้าง ──────────────────────────
-- ผลลัพธ์ข้อนี้สำคัญที่สุด — ส่งกลับมาให้ครบทุกแถว
SELECT TABLE_NAME, TABLE_ROWS, UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND (TABLE_NAME LIKE '%queue%'
    OR TABLE_NAME LIKE '%kiosk%'
    OR TABLE_NAME LIKE '%counter%'
    OR TABLE_NAME LIKE '%hygge%'
    OR TABLE_NAME LIKE '%finance%'
    OR TABLE_NAME LIKE '%cashier%')
ORDER BY UPDATE_TIME DESC, TABLE_NAME;


-- ── ข้อ 2) ตารางไหนมีข้อมูล "ของวันนี้" บ้าง ───────────────────────────────
-- UPDATE_TIME ในข้อ 1 ที่เป็นวันนี้ = ตารางที่ระบบคิวยังเขียนอยู่จริง
-- เอาชื่อตารางจากข้อ 1 มาใส่ทีละตัวแล้วดูหน้าตาข้อมูล เช่น
--   SELECT * FROM queue_list       ORDER BY 1 DESC LIMIT 20;
--   SELECT * FROM queue_detail     ORDER BY 1 DESC LIMIT 20;
--   SELECT * FROM queue_counter    ORDER BY 1 DESC LIMIT 20;
-- 👉 ส่งภาพหน้าตาข้อมูล 10–20 แถวของตารางที่ "มีข้อมูลวันนี้" กลับมา


-- ── ข้อ 3) ตารางคิวนั้นมีคอลัมน์อะไรบ้าง ──────────────────────────────────
-- เปลี่ยน 'queue_list' เป็นชื่อตารางจริงที่เจอในข้อ 1–2
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'queue_list'
ORDER BY ORDINAL_POSITION;


-- ── ข้อ 4) เช็กว่า HOSxP เวอร์ชันนี้มีคอลัมน์ที่ dashboard ใช้อยู่ครบไหม ──
-- ถ้าข้อนี้คืนไม่ครบ 5 แถว = สาเหตุที่คิวไม่ตรงอาจอยู่ตรงนี้
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'service_time'
  AND COLUMN_NAME IN ('vn','service6','service12','service16','service5_dep')
ORDER BY COLUMN_NAME;


-- ── ข้อ 5) คิวที่ dashboard เห็นตอนนี้ (เอาไว้เทียบกับจอคิวเก่า) ───────────
-- รันข้อนี้ "ตอนที่ยืนดูจอคิวเก่าอยู่" แล้วเทียบว่าลำดับต่างกันตรงไหน
SELECT q.send_time, q.patient_name, q.dept_name,
       q.income - q.paid_money AS ยอดค้าง,
       q.has_drug, q.cur_dep, q.status_name
FROM (
  SELECT
    o.vn, o.hn,
    CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS patient_name,
    COALESCE(kl.department, km.department, '') AS dept_name,
    COALESCE(o.cur_dep, '')                    AS cur_dep,
    COALESCE(os.name, '')                      AS status_name,
    COALESCE(v.income, 0)                      AS income,
    COALESCE(v.paid_money, 0)                  AS paid_money,
    st.service12                               AS after_doctor,
    st.service6                                AS at_pharmacy,
    CASE WHEN EXISTS (
           SELECT 1 FROM opitemrece oi
           INNER JOIN drugitems di ON di.icode = oi.icode
           WHERE oi.vn = o.vn
         ) THEN 1 ELSE 0 END                   AS has_drug,
    TIME_FORMAT(COALESCE(st.service6, st.service12, o.vsttime), '%H:%i') AS send_time
  FROM ovst o
  LEFT JOIN vn_stat       v  ON v.vn       = o.vn
  LEFT JOIN service_time  st ON st.vn      = o.vn
  LEFT JOIN patient       p  ON p.hn       = o.hn
  LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
  LEFT JOIN kskdepartment km ON km.depcode = o.main_dep
  LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
  WHERE o.vstdate = CURDATE()
    AND o.an IS NULL
    AND COALESCE(v.income, 0) > 0
) q
WHERE (q.has_drug = 0 AND q.after_doctor IS NOT NULL)
   OR (q.has_drug = 1 AND q.at_pharmacy  IS NOT NULL)
   OR q.paid_money > 0
ORDER BY q.send_time;
