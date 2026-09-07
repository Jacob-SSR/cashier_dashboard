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

  // ── ปรับเสียงประกาศได้จาก .env โดยไม่ต้องแก้โค้ด ──────────────────────
  // ลองสดบนจอก่อนได้ด้วย query string เช่น  /?rate=0.6&repeat=3
  const numParam = (key: string, envVal: string | undefined, fallback: number) => {
    const raw = Array.isArray(sp[key]) ? sp[key][0] : sp[key];
    const n = Number(raw ?? envVal ?? fallback);
    return Number.isFinite(n) ? n : fallback;
  };

  // 0.7 = ช้ากว่าปกติพอให้คนสูงอายุฟังทัน (1.0 = ความเร็วปกติของเสียงนั้น)
  const ttsRate = numParam("rate", process.env.TTS_RATE, 0.7);
  const ttsPitch = numParam("pitch", process.env.TTS_PITCH, 1.0);
  // พูดกี่รอบต่อการเรียก 1 ครั้ง
  const ttsRepeat = Math.max(1, Math.min(5, Math.round(numParam("repeat", process.env.TTS_REPEAT, 2))));
  // ข้อความประกาศ — {ชื่อ} จะถูกแทนด้วยชื่อคนไข้
  const ttsTextRaw = Array.isArray(sp.say) ? sp.say[0] : sp.say;
  const ttsText =
    ttsTextRaw || process.env.TTS_TEXT || "เชิญ {ชื่อ} ชำระเงินที่ห้องเก็บเงิน";

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
      ttsRate={ttsRate}
      ttsPitch={ttsPitch}
      ttsRepeat={ttsRepeat}
      ttsText={ttsText}
    />
  );
}
