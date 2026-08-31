// app/page.tsx
// เพจหลัก — ดึงข้อมูลรอบแรกฝั่ง server (จอเปิดมาเห็นข้อมูลทันที ไม่ต้องรอ fetch)
// จากนั้น CashierDashboard จะรีเฟรชเองผ่าน /api/cashier
import CashierDashboard from "./CashierDashboard";
import { getCashierQueue } from "@/lib/cashier.service";
import type { CashierData } from "@/lib/cashier.types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const hospitalName = process.env.HOSPITAL_NAME || "โรงพยาบาลพลับพลาชัย";
  const refreshSeconds = Number(process.env.REFRESH_SECONDS ?? 15);

  let initialData: CashierData;
  try {
    initialData = await getCashierQueue();
  } catch (err) {
    // DB ล่มตอนเปิดหน้า → ยังให้เปิดหน้าจอได้ แล้วให้ client ลองรีเฟรชเอง
    console.error("[page] initial load failed:", err);
    initialData = {
      updatedAt: new Date().toISOString(),
      date: "",
      source: "hosxp",
      rows: [],
      summary: { wait: 0, serving: 0, done: 0, total: 0, outstanding: 0 },
    };
  }

  return (
    <CashierDashboard
      initialData={initialData}
      hospitalName={hospitalName}
      callDisplayUrl="/display"
      refreshSeconds={refreshSeconds}
    />
  );
}
