// app/page.tsx
// จอคิวห้องการเงินสำหรับคนไข้ดู — เปิดหน้านี้เต็มจอ (F11) บนทีวีหน้าห้องการเงิน
// โหลดข้อมูลรอบแรกฝั่ง server (จอเปิดมาเห็นคิวทันที ไม่ต้องรอ fetch)
// จากนั้น QueueBoard จะรีเฟรช + ประกาศเรียกชื่อเองผ่าน /api/queue
import QueueBoard from "./QueueBoard";
import {
  getBoardQueue,
  boardRowLimit,
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


  // ── ปรับเสียงประกาศได้จาก .env โดยไม่ต้องแก้โค้ด ──────────────────────
  // ลองสดบนจอก่อนได้ด้วย query string เช่น  /?rate=0.6&repeat=3
  const numParam = (key: string, envVal: string | undefined, fallback: number) => {
    const raw = Array.isArray(sp[key]) ? sp[key][0] : sp[key];
    const n = Number(raw ?? envVal ?? fallback);
    return Number.isFinite(n) ? n : fallback;
  };

  // พูดกี่รอบต่อการเรียก 1 ครั้ง
  const ttsRepeat = Math.max(1, Math.min(5, Math.round(numParam("repeat", process.env.TTS_REPEAT, 2))));
  // ข้อความประกาศ — {ชื่อ} จะถูกแทนด้วยชื่อคนไข้
  const ttsTextRaw = Array.isArray(sp.say) ? sp.say[0] : sp.say;
  // ค่าเริ่มต้นยกมาจากจอเดิมเป๊ะ ๆ — " ขอเชิญ คุณ<ชื่อ> <นามสกุล> ที่ <แผนก> ค่ะ "
  // เปลี่ยนคำ/เครื่องหมายแล้วเสียงจะออกไม่เหมือนเดิม จึงไม่ควรแก้ถ้าไม่จำเป็น
  const ttsText =
    ttsTextRaw || process.env.TTS_TEXT || "ขอเชิญ {ชื่อ} ที่ {จุดบริการ} ค่ะ";
  // ประโยคปิดท้าย พูดครั้งเดียวหลังเรียกชื่อครบทุกรอบ — ตั้งค่าว่างเพื่อไม่ให้พูด
  const thanksRaw = Array.isArray(sp.thanks) ? sp.thanks[0] : sp.thanks;
  const ttsThanks = thanksRaw ?? process.env.TTS_THANKS ?? "ขอบคุณค่ะ";


  const boardTitle = process.env.BOARD_TITLE || "โรงพยาบาลพลับพลาชัย";
  // คำโปรยใต้ชื่อ รพ. — ตั้งเป็นค่าว่างเพื่อไม่ให้ขึ้น
  // วิสัยทัศน์ของ รพ. — ขึ้นบรรทัดใหม่ด้วย | (ตั้งเป็นค่าว่างเพื่อไม่ให้ขึ้น)
  const boardSubtitle =
    process.env.BOARD_SUBTITLE ??
    "โรงพยาบาลชุมชนคุณภาพสูง|การแพทย์ทันสมัย สุขใจใกล้บ้าน";
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
      boardSubtitle={boardSubtitle}
      rowLimit={boardRowLimit()}
      refreshSeconds={refreshSeconds}
      sound={sound}
      ttsRepeat={ttsRepeat}
      ttsText={ttsText}
      ttsThanks={ttsThanks}
    />
  );
}
