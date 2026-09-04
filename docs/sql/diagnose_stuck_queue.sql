-- หาว่า "4 คนที่ค้างบนจอใหม่ แต่จอเดิมไม่มี" จ่ายเงินไปแล้วหรือยัง
-- ถ้าคอลัมน์ไหนมีค่า/มากกว่า 0 ทุกคน → คอลัมน์นั้นคือสัญญาณ "จ่ายแล้ว" ตัวจริง
USE ppchos;

SELECT
  o.vn,
  o.oqueue                                   AS คิว,
  CONCAT(p.pname, p.fname)                   AS ชื่อ,
  TIME(o.cur_dep_time)                       AS ส่งมาเมื่อ,
  o.cur_dep, o.last_dep,
  s.department                               AS สถานะ_ovstost,

  -- ผู้สมัครสัญญาณ "จ่ายแล้ว" ตัวที่ 1 : ใบเสร็จถูกพิมพ์
  (SELECT COUNT(*) FROM rcpt_print r WHERE r.vn = o.vn)                       AS ใบเสร็จ,
  -- ตัวที่ 2 : rx_operator (ตัวที่ใช้อยู่ตอนนี้)
  (SELECT COUNT(*) FROM rx_operator r WHERE r.vn = o.vn)                      AS rx_ทั้งหมด,
  (SELECT COUNT(*) FROM rx_operator r WHERE r.vn = o.vn AND r.pay = 'Y')      AS rx_จ่ายแล้ว,
  -- ตัวที่ 3 : ยอดเงินในตารางสรุป
  o.finance_lock, o.finance_summary_date,
  (SELECT SUM(f.remain_money) FROM opd_opi_finance_summary f WHERE f.vn = o.vn) AS ค้างชำระ,
  (SELECT SUM(f.paid_money)   FROM opd_opi_finance_summary f WHERE f.vn = o.vn) AS จ่ายแล้ว_ยอด,
  -- ตัวที่ 4 : เวลาที่ service_time บันทึกว่าเสร็จการเงิน
  st.service6, st.service11, st.service12, st.service16

FROM ovst o
LEFT JOIN patient p       ON p.hn = o.hn
LEFT JOIN ovstost s       ON s.ovstost = o.ovstost
LEFT JOIN service_time st ON st.vn = o.vn
WHERE o.vstdate = CURDATE()
  AND o.an IS NULL
  AND o.cur_dep = '013'
  AND NOT EXISTS (SELECT 1 FROM rx_operator rp WHERE rp.vn = o.vn AND rp.pay = 'Y')
ORDER BY o.cur_dep_time;
