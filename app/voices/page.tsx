"use client";

// app/voices/page.tsx
// หน้าเช็กเสียง — เปิดบน "เครื่องที่เอาไปต่อจอ TV" เท่านั้น
//
// รายชื่อเสียงขึ้นกับ OS + เบราว์เซอร์ของเครื่องนั้น ไม่ใช่ของเซิร์ฟเวอร์
// จอ Sharp ที่ รพ. ใช้อาจไม่มี "สิริ" (เป็นเสียงของ Apple) หน้านี้ช่วยให้เห็นว่า
// เครื่องนั้นมีอะไรให้เลือกจริง ๆ แล้วเอาชื่อไปใส่ TTS_VOICE ใน .env.production
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../Icon";
import { pickVoice } from "../voice";

const SAMPLE = "เชิญ นางสาวสุภาพร ชำระเงินที่ห้องเก็บเงิน";

export default function VoicesPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [wanted, setWanted] = useState("Siri");

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const test = useCallback((v?: SpeechSynthesisVoice) => {
    const u = new SpeechSynthesisUtterance(SAMPLE);
    u.lang = v?.lang || "th-TH";
    u.rate = 0.88;
    u.pitch = 1.05;
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const thai = voices.filter((v) => v.lang.toLowerCase().startsWith("th"));
  const others = voices.filter((v) => !v.lang.toLowerCase().startsWith("th"));
  const chosen = pickVoice(voices, wanted);

  return (
    <main className="vx">
      <h1>เสียงที่เครื่องนี้มี</h1>
      <p className="vx-sub">
        รายชื่อนี้เป็นของ <b>เครื่องที่เปิดหน้านี้</b> ไม่ใช่ของเซิร์ฟเวอร์ —
        ต้องเปิดบนเครื่องที่ต่อกับจอ TV จริง ๆ ถึงจะเชื่อได้
      </p>

      <div className="vx-box">
        <label htmlFor="vx-want">ชื่อเสียงที่ตั้งไว้ (TTS_VOICE)</label>
        <input
          id="vx-want"
          value={wanted}
          onChange={(e) => setWanted(e.target.value)}
          placeholder="เช่น Siri, Premwadee, Kanya"
        />
        <p>
          จอจะเลือกใช้ →{" "}
          {chosen ? (
            <b>
              {chosen.name} <span className="vx-lang">({chosen.lang})</span>
            </b>
          ) : (
            <b className="vx-none">ไม่พบเสียงไทยในเครื่องนี้</b>
          )}
        </p>
        <button type="button" onClick={() => test(chosen ?? undefined)}>
          <Icon name="play" /> ฟังตัวอย่าง
        </button>
      </div>

      <h2>เสียงไทย ({thai.length})</h2>
      {thai.length === 0 && (
        <p className="vx-warn">
          เครื่องนี้ไม่มีเสียงไทยเลย — จอจะประกาศไม่ได้ ต้องลงเสียงไทยของ OS ก่อน
          (Windows: Settings → Time &amp; language → Speech → Add voices → ไทย)
        </p>
      )}
      <ul>
        {thai.map((v) => (
          <li key={`${v.name}-${v.lang}`}>
            <button type="button" onClick={() => test(v)} aria-label={`ฟัง ${v.name}`}>
              <Icon name="play" />
            </button>
            <span className="vx-name">{v.name}</span>
            <span className="vx-lang">{v.lang}</span>
            {v.default && <span className="vx-tag">ค่าเริ่มต้น</span>}
          </li>
        ))}
      </ul>

      <details>
        <summary>เสียงภาษาอื่น ({others.length})</summary>
        <ul>
          {others.map((v) => (
            <li key={`${v.name}-${v.lang}`}>
              <button type="button" onClick={() => test(v)} aria-label={`ฟัง ${v.name}`}>
                <Icon name="play" />
              </button>
              <span className="vx-name">{v.name}</span>
              <span className="vx-lang">{v.lang}</span>
            </li>
          ))}
        </ul>
      </details>

      <p className="vx-sub">
        เจอตัวที่ชอบแล้ว ใส่ชื่อลง <code>TTS_VOICE</code> ใน{" "}
        <code>.env.production</code> แล้ว <code>docker compose up -d --build</code>
        <br />
        หรือลองสดบนจอด้วย <code>/?voice=ชื่อเสียง</code> ก่อนก็ได้
      </p>
    </main>
  );
}
