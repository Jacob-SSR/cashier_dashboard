// app/page.tsx
// จอคิวห้องการเงินสำหรับคนไข้ดู — เปิดหน้านี้เต็มจอ (F11) บนทีวีหน้าห้องการเงิน
// โหลดข้อมูลรอบแรกฝั่ง server (จอเปิดมาเห็นคิวทันที ไม่ต้องรอ fetch)
// จากนั้น QueueBoard จะรีเฟรช + ประกาศเรียกชื่อเองผ่าน /api/queue
import QueueBoard from "./QueueBoard";
import {
  getBoardQueue,
  boardRowLimit,
  boardRowsPerColumn,
} from "@/lib/cashier.service";
import type { BoardData } from "@/lib/cashier.types";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // ?sound=0 = ปิดเสียงจอนี้ (ใช้ตอนเปิดหลายจอในห้องเดียวกัน กันเสียงซ้อน)
  const sound = (Array.isArray(sp.sound) ? sp.sound[0] : sp.sound) !== "0";

  // เสียงที่ใช้ประกาศ — หน้างานเลือก "สิริ" ลองสลับสด ๆ ได้ด้วย ?voice=premwadee
  // ดูว่าเครื่องที่ต่อจอมีเสียงอะไรบ้างที่ /voices
  const voiceParam = Array.isArray(sp.voice) ? sp.voice[0] : sp.voice;
  const voiceName = voiceParam || process.env.TTS_VOICE || "Siri";

  const boardTitle =
    process.env.BOARD_TITLE || "ห้องเก็บเงินโรงพยาบาลพลับพลาชัย";
  const refreshSeconds = Number(process.env.REFRESH_SECONDS ?? 15);

  let initialData: BoardData;
  try {
    initialData = await getBoardQueue();
  } catch (err) {
    // DB ล่มตอนเปิดจอ → ยังขึ้นหน้าจอได้ แล้วให้ client ลองรีเฟรชเอง
    console.error("[board] initial load failed:", err);
    initialData = {
      updatedAt: new Date().toISOString(),
      date: "",
      source: "hosxp",
      rows: [],
      called: [],
      waiting: 0,
      done: 0,
    };
  }

  return (
    <QueueBoard
      initialData={initialData}
      boardTitle={boardTitle}
      rowLimit={boardRowLimit()}
      rowsPerColumn={boardRowsPerColumn()}
      refreshSeconds={refreshSeconds}
      sound={sound}
      voiceName={voiceName}
    />
  );
}
