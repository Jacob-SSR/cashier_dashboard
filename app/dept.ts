// app/dept.ts
// จับคู่ "ชื่อแผนก" → สีป้าย + ไอคอน (ไอคอนเป็น SVG ใน app/Icon.tsx ไม่ใช่ emoji)
// ชื่อแผนกมาจาก kskdepartment ของแต่ละ รพ. จึงจับด้วย keyword ไม่ใช่ชื่อเป๊ะ
// เพิ่ม/แก้ keyword ได้ตามชื่อแผนกจริง (แถวบนสุดที่ตรงก่อน = ชนะ)

import type { IconName } from "./Icon";

export interface DeptStyle {
  cls: string;
  icon: IconName;
}

const RULES: { keywords: string[]; style: DeptStyle }[] = [
  { keywords: ["ห้องยา", "เภสัช", "จ่ายยา"], style: { cls: "dept-pharm", icon: "pharmacy" } },
  { keywords: ["ทันตกรรม", "ทันตก", "ฟัน"], style: { cls: "dept-dental", icon: "dental" } },
  { keywords: ["ฉุกเฉิน", "อุบัติเหตุ", "ER"], style: { cls: "dept-er", icon: "emergency" } },
  { keywords: ["อายุรกรรม", "อายุรก"], style: { cls: "dept-med", icon: "medicine" } },
  { keywords: ["กุมาร", "เด็ก"], style: { cls: "dept-peds", icon: "pediatrics" } },
  { keywords: ["สูติ", "นรีเวช", "ฝากครรภ์", "ANC"], style: { cls: "dept-ob", icon: "obstetrics" } },
  { keywords: ["ออร์โธ", "กระดูก", "ศัลย"], style: { cls: "dept-ortho", icon: "orthopedic" } },
  { keywords: ["คลินิก", "ตรวจโรค", "OPD"], style: { cls: "dept-gen", icon: "clinic" } },

  // ── แผนกที่เคยตกไปใช้ไอคอนสำรอง ทำให้จอขึ้นรูปที่ไม่สื่อความหมาย ──
  // "ห้องเก็บเงิน" คือชื่อที่โผล่บ่อยที่สุดในส่วน "เรียกคิว" (มาจาก kskdepartment
  // ของจุดที่กดเรียก) จึงต้องมีไอคอนของตัวเอง ไม่ใช่ไปใช้ตัวสำรอง
  { keywords: ["เก็บเงิน", "การเงิน", "ชำระเงิน", "ชำระ", "cashier"], style: { cls: "dept-gen", icon: "money" } },
  { keywords: ["ห้องบัตร", "เวชระเบียน", "ลงทะเบียน", "ทะเบียน"], style: { cls: "dept-gen", icon: "card" } },
  { keywords: ["คัดกรอง", "ซักประวัติ", "triage", "screen"], style: { cls: "dept-gen", icon: "screening" } },
  { keywords: ["แล็บ", "แลป", "ชันสูตร", "เทคนิคการแพทย์", "lab"], style: { cls: "dept-gen", icon: "lab" } },
  { keywords: ["รังสี", "เอกซเรย์", "เอ็กซเรย์", "x-ray", "xray"], style: { cls: "dept-gen", icon: "xray" } },
];

// ตัวสำรองต้องเป็นรูปที่ "ไม่สื่ออะไรผิด" ได้เลย — กากบาทการแพทย์ในกรอบมน
// ปลอดภัยที่สุด เพราะทุกแผนกใน รพ. เป็นจุดบริการทางการแพทย์อยู่แล้ว
const FALLBACK: DeptStyle = { cls: "dept-gen", icon: "clinic" };

export function deptStyle(dept: string): DeptStyle {
  const name = (dept || "").toLowerCase();
  for (const r of RULES) {
    if (r.keywords.some((k) => name.includes(k.toLowerCase()))) return r.style;
  }
  return FALLBACK;
}
