// lib/cashier.demo.ts
// ข้อมูลตัวอย่างสำหรับโหมด demo (ยังไม่ตั้งค่า DB หรือ DEMO_MODE=1)
// ชุดเดียวกับต้นแบบ cashier_dashboard.html — ใช้ตอนติดตั้ง/สาธิตหน้าจอ
import type { CashierRoute, CashierRow, CashierStatus } from "@/lib/cashier.types";

interface Seed {
  hn: string;
  name: string;
  dept: string;
  status: CashierStatus;
  amount: number;
}

const SEED: Seed[] = [
  { hn: "HN-00812", name: "นางสาวสุภาพร ใจดี", dept: "ห้องยา", status: "ชำระแล้ว", amount: 350 },
  { hn: "HN-02341", name: "นายสมชาย รักไทย", dept: "คลินิกทั่วไป", status: "ชำระแล้ว", amount: 120 },
  { hn: "HN-00456", name: "นางมาลี สุขสม", dept: "ทันตกรรม", status: "ชำระแล้ว", amount: 800 },
  { hn: "HN-03120", name: "นายประสิทธิ์ ดีมาก", dept: "ฉุกเฉิน", status: "ชำระแล้ว", amount: 2450 },
  { hn: "HN-00988", name: "เด็กชายธีรภัทร ฝันดี", dept: "กุมารเวชกรรม", status: "ชำระแล้ว", amount: 280 },
  { hn: "HN-01555", name: "นางสาวพิมพ์ชนก สายรุ้ง", dept: "ห้องยา", status: "ชำระแล้ว", amount: 425 },
  { hn: "HN-02890", name: "นายวิชัย มั่นคง", dept: "อายุรกรรม", status: "ชำระแล้ว", amount: 660 },
  { hn: "HN-00741", name: "นางรัตนา แก้วใส", dept: "สูตินรีเวช", status: "ชำระแล้ว", amount: 1200 },
  { hn: "HN-03300", name: "นายกิตติ สว่างใจ", dept: "ออร์โธปิดิกส์", status: "ชำระแล้ว", amount: 1850 },
  { hn: "HN-01200", name: "นางสาวอรทัย เพชรงาม", dept: "ห้องยา", status: "ชำระแล้ว", amount: 195 },
  { hn: "HN-00620", name: "นายเดชา หาญกล้า", dept: "คลินิกทั่วไป", status: "ชำระแล้ว", amount: 150 },
  { hn: "HN-02700", name: "นางชลิตา ใสสะอาด", dept: "ทันตกรรม", status: "ชำระแล้ว", amount: 950 },
  { hn: "HN-01890", name: "นายอนุวัฒน์ พงษ์ไทย", dept: "อายุรกรรม", status: "ชำระแล้ว", amount: 580 },
  { hn: "HN-03450", name: "เด็กหญิงณัฐชา ดอกไม้", dept: "กุมารเวชกรรม", status: "ชำระแล้ว", amount: 320 },
  { hn: "HN-00333", name: "นางปาริชาต สีทอง", dept: "ห้องยา", status: "ชำระแล้ว", amount: 475 },
  { hn: "HN-02100", name: "นายสุรชัย ทรัพย์ดี", dept: "ออร์โธปิดิกส์", status: "ชำระแล้ว", amount: 2100 },
  { hn: "HN-01440", name: "นางสาวลลิตา มีสุข", dept: "สูตินรีเวช", status: "ชำระแล้ว", amount: 890 },
  { hn: "HN-00900", name: "นายบุญมี ร่วมใจ", dept: "คลินิกทั่วไป", status: "ชำระแล้ว", amount: 110 },
  { hn: "HN-03600", name: "นายณรงค์ศักดิ์ ใจซื่อ", dept: "ฉุกเฉิน", status: "ชำระแล้ว", amount: 3200 },
  { hn: "HN-02250", name: "นางพรพิมล แสนดี", dept: "ห้องยา", status: "ชำระแล้ว", amount: 380 },
  { hn: "HN-01080", name: "เด็กชายปิติพล สดใส", dept: "กุมารเวชกรรม", status: "ชำระแล้ว", amount: 260 },
  { hn: "HN-03750", name: "นางสาวกนกวรรณ ไพเราะ", dept: "ทันตกรรม", status: "ชำระแล้ว", amount: 1100 },
  { hn: "HN-00565", name: "นายพรหมมินทร์ คงดี", dept: "อายุรกรรม", status: "รอชำระ", amount: 720 },
  { hn: "HN-02680", name: "นางสาวศิริรัตน์ วงศ์งาม", dept: "ห้องยา", status: "รอชำระ", amount: 415 },
  { hn: "HN-01320", name: "นายธนกฤต สมาร์ท", dept: "คลินิกทั่วไป", status: "รอชำระ", amount: 140 },
  { hn: "HN-03900", name: "นางทิพย์วัล สุขภาพดี", dept: "สูตินรีเวช", status: "รอชำระ", amount: 1050 },
  { hn: "HN-00720", name: "นายวรพล เชี่ยวชาญ", dept: "ออร์โธปิดิกส์", status: "รอชำระ", amount: 1680 },
  { hn: "HN-02420", name: "นางสาวพัชรี สดชื่น", dept: "ห้องยา", status: "รอชำระ", amount: 290 },
  { hn: "HN-01760", name: "นายศักดิ์ดา ยืนยง", dept: "อายุรกรรม", status: "รอชำระ", amount: 840 },
  { hn: "HN-00150", name: "เด็กหญิงอารยา น่ารัก", dept: "กุมารเวชกรรม", status: "รอชำระ", amount: 310 },
  { hn: "HN-04010", name: "นางสมหมาย เข้มแข็ง", dept: "ห้องยา", status: "รอชำระ", amount: 530 },
  { hn: "HN-02950", name: "นายชลธี สายน้ำ", dept: "ทันตกรรม", status: "รอชำระ", amount: 1250 },
  { hn: "HN-01620", name: "นางสาวกัลยา มงคล", dept: "คลินิกทั่วไป", status: "รอชำระ", amount: 180 },
  { hn: "HN-03140", name: "นายอำนาจ ซื่อสัตย์", dept: "ฉุกเฉิน", status: "รอชำระ", amount: 2800 },
];

/**
 * เวลา "ถูกส่งมาห้องเก็บเงิน" ของข้อมูลตัวอย่าง — นับถอยหลังจากเวลาปัจจุบัน
 * (ถ้า fix เวลาไว้ตายตัว พอเปิดดูตอนเย็นทุกแถวจะเกิน QUEUE_MAX_AGE_MINUTES
 *  แล้วโดนตัดออกหมด จอสาธิตจะว่างเปล่าทั้งที่ระบบทำงานถูก)
 */
function timeMinutesAgo(minutes: number): string {
  const now = new Date();
  const bangkok = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  bangkok.setMinutes(bangkok.getMinutes() - minutes);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(bangkok.getHours())}:${p(bangkok.getMinutes())}`;
}

/** VN ของ HOSxP = YYMMDDxxxx (พ.ศ. 2 หลักท้าย) — ทำให้ข้อมูลตัวอย่างหน้าตาเหมือนของจริง */
function vnPrefix(): string {
  const now = new Date();
  const be = (now.getFullYear() + 543) % 100;
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${String(be).padStart(2, "0")}${mm}${dd}`;
}

export function demoRows(): CashierRow[] {
  const prefix = vnPrefix();
  return SEED.map((s, i) => {
    const vn = `${prefix}-${String(i + 1).padStart(4, "0")}`;
    // เลขคิวตัวอย่าง — ของจริงมาจาก ovst.oqueue ซึ่งเป็น integer ล้วน (เช่น 39)
    const queueNo = String(i + 1);
    // คนท้ายแถว = เพิ่งถูกส่งมา, คนแรก ๆ = ส่งมานานแล้ว (ห่างกันแถวละ 3 นาที)
    const time = timeMinutesAgo((SEED.length - i) * 3);
    // ข้อมูลตัวอย่าง: คนจากห้องยาถือว่ามียาแน่ ๆ ที่เหลือสลับมี/ไม่มี ให้เห็นทั้งสองเส้นทาง
    const route: CashierRoute =
      s.dept === "ห้องยา" || i % 3 !== 0 ? "มียา" : "ไม่มียา";
    const nextStep =
      s.status === "ชำระแล้ว"
        ? route === "มียา"
          ? "กลับไปรับยาที่ห้องยา"
          : "กลับบ้าน"
        : "";
    return { id: vn, vn, queueNo, priority: 0, time, route, nextStep, ...s };
  });
}
