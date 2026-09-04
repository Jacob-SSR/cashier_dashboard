-- ═══════════════════════════════════════════════════════════════════════════
--  เทียบ "ใครอยู่ห้องเก็บเงินตอนนี้" กับจอเดิมของ รพ.
--
--  วิธีใช้: รัน query นี้ "พร้อมกับถ่ายรูปจอเดิม" แล้วส่งมาทั้งคู่
--           จะได้เทียบทีละชื่อว่าใครเกิน/ใครขาด และเพราะอะไร
--  (SELECT อ่านอย่างเดียว ไม่แก้ข้อมูล)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  TIME_FORMAT(o.cur_dep_time, '%H:%i')       AS เวลาส่ง,
  o.oqueue                                    AS คิว,
  CONCAT_WS(' ', p.pname, p.fname, p.lname)   AS ชื่อ,
  kl.department                               AS แผนกที่ส่งมา,
  k.department                                AS อยู่แผนกตอนนี้,

  -- ── เหตุผลที่อาจทำให้ "จอเดิมไม่โชว์ แต่จอใหม่โชว์" ──
  COALESCE(os.name, '(ไม่มีสถานะ)')            AS สถานะ_ovstost,
  o.finance_summary_date                      AS ปิดยอดเมื่อ,
  o.finance_lock                              AS finance_lock,
  COALESCE(fc.bal, -1)                        AS ยอดคงเหลือ,
  COALESCE(fc.clr, -1)                        AS เคลียร์แล้ว,
  TIMESTAMPDIFF(MINUTE, o.cur_dep_time, NOW()) AS รอมาแล้วกี่นาที,
  o.an                                        AS an

FROM ovst o
LEFT JOIN patient       p  ON p.hn       = o.hn
LEFT JOIN kskdepartment k  ON k.depcode  = o.cur_dep
LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
LEFT JOIN (
  SELECT f.vn AS vn,
         SUM(COALESCE(f.balance_amount,0)) AS bal,
         SUM(COALESCE(f.clear_amount,0))   AS clr
  FROM opd_opi_finance_summary f
  INNER JOIN ovst o2 ON o2.vn = f.vn AND o2.vstdate = CURDATE()
  GROUP BY f.vn
) fc ON fc.vn = o.vn

WHERE o.vstdate = CURDATE()
  AND o.cur_dep = '013'          -- ห้องเก็บเงิน
ORDER BY o.cur_dep_time;


-- ═══ วิธีอ่านผล ═══════════════════════════════════════════════════════════
-- 1) นับจำนวนแถว เทียบกับจำนวนคนใน "คิวรอ" ของจอเดิม
--
-- 2) คนที่ "จอใหม่มี แต่จอเดิมไม่มี" → ดูว่าเขาต่างจากคนอื่นตรงคอลัมน์ไหน
--      ยอดคงเหลือ = 0        → จ่ายแล้ว แต่ cur_dep ยังค้างที่ 013
--      ปิดยอดเมื่อ มีค่า      → ปิดยอดแล้ว แต่ cur_dep ยังค้าง
--      สถานะ_ovstost แปลก ๆ  → จอเดิมอาจกรองสถานะนี้ออก
--      รอมาแล้วกี่นาที เยอะ   → จอเดิมอาจตัดคนที่รอเกิน X นาที
--      an ไม่ว่าง             → ถูก admit ไปแล้ว
--
-- 3) คนที่ "จอเดิมมี แต่จอใหม่ไม่มี" → แปลว่าเขา cur_dep ไม่ใช่ 013
--    ให้รัน query ข้างล่างเพื่อหาว่าเขาอยู่แผนกไหน (ใส่ชื่อที่เห็นบนจอเดิม)


-- ── หาคนที่เห็นบนจอเดิมแต่ไม่โผล่ในจอใหม่ (แก้ชื่อตรง LIKE) ──────────────
SELECT
  TIME_FORMAT(o.cur_dep_time, '%H:%i')      AS เวลาเข้าแผนกนี้,
  o.oqueue                                   AS คิว,
  CONCAT_WS(' ', p.pname, p.fname, p.lname)  AS ชื่อ,
  o.cur_dep                                  AS cur_dep,
  k.department                               AS อยู่แผนกตอนนี้,
  o.last_dep                                 AS last_dep,
  kl.department                              AS แผนกก่อนหน้า,
  COALESCE(os.name, '')                      AS สถานะ_ovstost
FROM ovst o
LEFT JOIN patient       p  ON p.hn       = o.hn
LEFT JOIN kskdepartment k  ON k.depcode  = o.cur_dep
LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
WHERE o.vstdate = CURDATE()
  AND (p.fname LIKE 'สิราวรรณ%' OR p.fname LIKE 'ปรียา%' OR p.fname LIKE 'เบี่ยง%')
ORDER BY o.cur_dep_time;
