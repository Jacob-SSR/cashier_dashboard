// lib/mask.ts
// ปิดบังนามสกุลก่อนขึ้นจอ TV ที่คนไข้/ญาติมองเห็นได้
// (ชื่อเต็มยังใช้ได้บนคอนโซลเจ้าหน้าที่ + จอเรียกชื่อ ซึ่งเรียกทีละคน)

/**
 * "นางสาว สุภาพร ใจดี" → "นางสาว สุภาพร ใ●●●"
 * "นางสาวสุภาพร ใจดี"  → "นางสาวสุภาพร ใ●●●"
 * คำสุดท้าย = นามสกุล เหลือไว้ตัวแรกตัวเดียว ที่เหลือแทนด้วย ●
 * ถ้ามีคำเดียว (ข้อมูลไม่ครบ) คืนค่าเดิม — ไม่มีนามสกุลให้ปิดอยู่แล้ว
 */
export function maskSurname(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;

  const surname = parts[parts.length - 1];
  const masked = surname.slice(0, 1) + "●".repeat(Math.max(2, Math.min(surname.length - 1, 4)));

  return [...parts.slice(0, -1), masked].join(" ");
}
