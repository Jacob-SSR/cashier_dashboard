"use client";

// app/sound-test/page.tsx
// หน้าทดสอบเสียงบน "เครื่อง/ทีวีที่เอาไปแขวนจริง"
//
// เสียงถูกสร้างที่เซิร์ฟเวอร์แล้วส่งมาเป็น MP3 ทีวีจึงเล่นด้วย <audio> มาตรฐาน
// หน้านี้ช่วยแยกให้ออกว่าถ้าไม่มีเสียง ปัญหาอยู่ตรงไหน:
//   1) เซิร์ฟเวอร์สร้างเสียงไม่ได้  → ออกเน็ตไป translate.google.com ไม่ได้
//   2) เซิร์ฟเวอร์สร้างได้แต่ทีวีไม่เล่น → ติดนโยบาย autoplay ต้องกดปุ่มก่อน
import { useCallback, useRef, useState } from "react";
import { AudioQueueManager } from "@/lib/audio/AudioQueueManager";
import { Icon } from "../Icon";

const SAMPLE = "ขอเชิญ คุณสมชาย ใจดี ที่ ห้องเก็บเงิน ค่ะ";

export default function SoundTestPage() {
  const [text, setText] = useState(SAMPLE);
  const [status, setStatus] = useState<string>("");
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const audio = useRef<AudioQueueManager | null>(null);

  const getAudio = useCallback(() => {
    if (!audio.current) audio.current = new AudioQueueManager();
    return audio.current;
  }, []);

  const url = `/api/tts?text=${encodeURIComponent(text)}`;

  /** ขั้นที่ 1 — เซิร์ฟเวอร์สร้าง MP3 ได้ไหม (ไม่เกี่ยวกับลำโพง) */
  const checkServer = useCallback(async () => {
    setStatus("กำลังขอไฟล์เสียงจากเซิร์ฟเวอร์...");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const detail = await res.text();
        setServerOk(false);
        setStatus(`เซิร์ฟเวอร์สร้างเสียงไม่ได้ (HTTP ${res.status}) ${detail.slice(0, 200)}`);
        return;
      }
      const blob = await res.blob();
      setServerOk(true);
      setStatus(
        `เซิร์ฟเวอร์สร้างเสียงได้ — ${blob.type || "audio/mpeg"} ขนาด ${Math.round(blob.size / 1024)} KB`,
      );
    } catch (err) {
      setServerOk(false);
      setStatus(`ติดต่อเซิร์ฟเวอร์ไม่ได้: ${String(err)}`);
    }
  }, [url]);

  /** ขั้นที่ 2 — ทีวีเล่นออกลำโพงได้ไหม (ต้องกดปุ่มนี้ = user gesture) */
  const play = useCallback(async () => {
    setStatus("กำลังปลดล็อกเสียงและเล่น...");
    const mgr = getAudio();
    const unlocked = await mgr.unlock();
    mgr.enqueue(url, () => setStatus(unlocked ? "เล่นจบแล้ว" : "เล่นจบ (ปลดล็อกไม่สำเร็จ)"));
  }, [getAudio, url]);

  return (
    <main className="vx">
      <h1>ทดสอบเสียงเรียกคิว</h1>
      <p className="vx-sub">
        เปิดหน้านี้บน <b>เครื่องหรือทีวีที่เอาไปแขวนจริง</b> — เสียงสร้างที่เซิร์ฟเวอร์
        ด้วย Google Translate TTS ตัวเดียวกับจอคิวเดิมของ รพ. ทีวีเล่นเป็นไฟล์ MP3 ธรรมดา
      </p>

      <div className="vx-box">
        <label htmlFor="vx-text">ข้อความที่จะให้อ่าน</label>
        <input id="vx-text" value={text} onChange={(e) => setText(e.target.value)} />

        <p>
          <button type="button" onClick={checkServer}>
            1. เช็คเซิร์ฟเวอร์
          </button>{" "}
          <button type="button" onClick={play}>
            <Icon name="play" /> 2. เล่นออกลำโพง
          </button>
        </p>

        {status && <p className={serverOk === false ? "vx-warn" : ""}>{status}</p>}
      </div>

      <h2>อ่านผลยังไง</h2>
      <ul>
        <li>
          <span className="vx-name">ปุ่ม 1 ไม่ผ่าน</span>
          <span className="vx-lang">
            เครื่องที่รัน docker ออกเน็ตไป translate.google.com ไม่ได้ — เช็คไฟร์วอลล์/พร็อกซี
          </span>
        </li>
        <li>
          <span className="vx-name">ปุ่ม 1 ผ่าน แต่ปุ่ม 2 เงียบ</span>
          <span className="vx-lang">
            ทีวีบล็อก autoplay — ที่จอคิวให้กดปุ่ม OK บนรีโมตหนึ่งครั้งตอนเปิดจอ
          </span>
        </li>
        <li>
          <span className="vx-name">ผ่านทั้งคู่</span>
          <span className="vx-lang">เสียงพร้อมใช้งานบนทีวีเครื่องนี้</span>
        </li>
      </ul>

      <p className="vx-sub">
        เปิดไฟล์เสียงตรง ๆ ก็ได้: <code>{url}</code>
      </p>
    </main>
  );
}
