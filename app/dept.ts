// app/dept.ts
// จับคู่ "ชื่อแผนก" → สีป้าย + ไอคอน
// ชื่อแผนกมาจาก kskdepartment ของแต่ละ รพ. จึงจับด้วย keyword ไม่ใช่ชื่อเป๊ะ
// เพิ่ม/แก้ keyword ได้ตามชื่อแผนกจริง (แถวบนสุดที่ตรงก่อน = ชนะ)

export interface DeptStyle {
  cls: string;
  icon: string;
}

const RULES: { keywords: string[]; style: DeptStyle }[] = [
  { keywords: ["ห้องยา", "เภสัช", "จ่ายยา"], style: { cls: "dept-pharm", icon: "💊" } },
  { keywords: ["ทันตกรรม", "ทันตก", "ฟัน"], style: { cls: "dept-dental", icon: "🦷" } },
  { keywords: ["ฉุกเฉิน", "อุบัติเหตุ", "ER"], style: { cls: "dept-er", icon: "🚨" } },
  { keywords: ["อายุรกรรม", "อายุรก"], style: { cls: "dept-med", icon: "⚕️" } },
  { keywords: ["กุมาร", "เด็ก"], style: { cls: "dept-peds", icon: "👶" } },
  { keywords: ["สูติ", "นรีเวช", "ฝากครรภ์", "ANC"], style: { cls: "dept-ob", icon: "🌸" } },
  { keywords: ["ออร์โธ", "กระดูก", "ศัลย"], style: { cls: "dept-ortho", icon: "🦴" } },
  { keywords: ["คลินิก", "ตรวจโรค", "OPD"], style: { cls: "dept-gen", icon: "🏥" } },
];

const FALLBACK: DeptStyle = { cls: "dept-gen", icon: "🏥" };

export function deptStyle(dept: string): DeptStyle {
  const name = (dept || "").toLowerCase();
  for (const r of RULES) {
    if (r.keywords.some((k) => name.includes(k.toLowerCase()))) return r.style;
  }
  return FALLBACK;
}
