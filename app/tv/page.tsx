// app/tv/page.tsx
// จอคิวสำหรับทีวีหน้าห้องเก็บเงิน — ไม่มี VN/HN, นามสกุลปิดบัง, แสดง TV_ROWS คิวแรก
import TvBoard from "../TvBoard";
import { getTvQueue, tvRowLimit, tvRowsPerColumn } from "@/lib/cashier.service";
import type { TvData } from "@/lib/cashier.types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คิวชำระเงิน — ห้องเก็บเงินแดง",
};

export default async function TvPage() {
  const hospitalName = process.env.HOSPITAL_NAME || "โรงพยาบาลพลับพลาชัย";
  const refreshSeconds = Number(process.env.REFRESH_SECONDS ?? 15);
  const rowLimit = tvRowLimit();
  const rowsPerColumn = tvRowsPerColumn();

  let initialData: TvData;
  try {
    initialData = await getTvQueue();
  } catch (err) {
    // DB ล่มตอนเปิดจอ → ยังขึ้นหน้าจอได้ แล้วให้ client ลองรีเฟรชเอง
    console.error("[tv] initial load failed:", err);
    initialData = {
      updatedAt: new Date().toISOString(),
      date: "",
      source: "hosxp",
      rows: [],
      waiting: 0,
      done: 0,
    };
  }

  return (
    <TvBoard
      initialData={initialData}
      hospitalName={hospitalName}
      rowLimit={rowLimit}
      rowsPerColumn={rowsPerColumn}
      refreshSeconds={refreshSeconds}
    />
  );
}
