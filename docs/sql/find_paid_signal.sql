-- ═══════════════════════════════════════════════════════════════════════════
--  หา "สัญญาณว่าจ่ายเงินแล้ว" ของ HOSxP รพ.พลับพลาชัย
--
--  รันตอนที่รู้ว่าใครจ่ายแล้ว/ใครยังไม่จ่าย (เช่นตอนเย็นเหลือคนน้อย ๆ)
--  แล้วดูว่าคอลัมน์ไหน "ต่างกัน" ระหว่าง 2 กลุ่ม → นั่นคือสัญญาณที่ต้องใช้
--
--  รันแค่ query เดียว แล้วส่งภาพผลลัพธ์กลับมาก็พอ (SELECT อ่านอย่างเดียว)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  o.oqueue                                    AS คิว,
  CONCAT_WS(' ', p.pname, p.fname, p.lname)   AS ชื่อ,
  TIME_FORMAT(o.cur_dep_time, '%H:%i')        AS เวลาส่ง,
  k.department                                AS อยู่แผนกตอนนี้,
  kl.department                               AS แผนกที่ส่งมา,

  -- ── ผู้ต้องสงสัย 5 ตัว ว่าตัวไหนบอกว่า "จ่ายแล้ว" ──
  os.name                                     AS สถานะ_ovstost,
  o.finance_summary_date                      AS ปิดยอดเมื่อ,
  o.finance_lock                              AS finance_lock,
  COALESCE(fc.bal, -1)                        AS ยอดคงเหลือ,      -- -1 = ไม่มีแถวในตารางสรุป
  COALESCE(fc.clr, -1)                        AS เคลียร์แล้ว,
  COALESCE(ch.amt, 0)                         AS ยอดค่าใช้จ่าย,
  COALESCE(v.income, 0)                       AS income,
  COALESCE(v.paid_money, 0)                   AS paid_money

FROM ovst o
LEFT JOIN patient       p  ON p.hn       = o.hn
LEFT JOIN kskdepartment k  ON k.depcode  = o.cur_dep
LEFT JOIN kskdepartment kl ON kl.depcode = o.last_dep
LEFT JOIN ovstost       os ON os.ovstost = o.ovstost
LEFT JOIN vn_stat       v  ON v.vn       = o.vn

-- ยอดค่าใช้จ่ายจาก opitemrece (จำกัดแค่ visit ของวันนี้ ไม่สแกนทั้งตาราง)
LEFT JOIN (
  SELECT oi.vn AS vn, SUM(COALESCE(oi.sum_price,0)) AS amt
  FROM opitemrece oi
  INNER JOIN ovst o2 ON o2.vn = oi.vn AND o2.vstdate = CURDATE()
  GROUP BY oi.vn
) ch ON ch.vn = o.vn

-- ยอดจากตารางสรุปการเงิน
LEFT JOIN (
  SELECT f.vn AS vn,
         SUM(COALESCE(f.balance_amount,0)) AS bal,
         SUM(COALESCE(f.clear_amount,0))   AS clr
  FROM opd_opi_finance_summary f
  INNER JOIN ovst o3 ON o3.vn = f.vn AND o3.vstdate = CURDATE()
  GROUP BY f.vn
) fc ON fc.vn = o.vn

WHERE o.vstdate = CURDATE()
  AND o.an IS NULL
  AND o.cur_dep = '013'          -- ห้องเก็บเงิน
ORDER BY CAST(o.oqueue AS UNSIGNED);


-- ═══ วิธีอ่านผล ═══════════════════════════════════════════════════════════
-- เอาแถวของ "คนที่ยังไม่จ่าย 3 คน" ไปเทียบกับแถวของ "คนที่จ่ายไปแล้ว"
-- คอลัมน์ไหนต่างกันชัดเจน = สัญญาณที่ dashboard ต้องใช้
--
--   ปิดยอดเมื่อ    มีค่าเฉพาะคนที่จ่ายแล้ว  → ใช้ finance_summary_date
--   ยอดคงเหลือ     คนจ่ายแล้ว = 0            → ใช้ opd_opi_finance_summary
--   finance_lock   ต่างกัน                   → ใช้ finance_lock
--   สถานะ_ovstost  ต่างกัน                   → ใช้ ovstost
--   paid_money     คนจ่ายแล้ว > 0            → ใช้ vn_stat.paid_money
--
-- ถ้า "ไม่มีคอลัมน์ไหนต่างเลย" = HOSxP ไม่ได้บันทึกการรับเงินไว้ที่ visit
-- ต้องไปดูตารางใบเสร็จแทน (บอกได้ จะหาต่อให้)
