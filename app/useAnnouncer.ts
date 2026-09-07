"use client";

// app/useAnnouncer.ts
// ประกาศเรียกชื่อคนที่ถึงคิว "อัตโนมัติ" — ไม่มีปุ่มให้ใครกด
//
// จังหวะที่ประกาศ: เมื่อ "คนหัวแถวเปลี่ยน" เท่านั้น
//   เจ้าหน้าที่กดรับเงินใน HOSxP → คนนั้นจ่ายครบ → หลุดจากคิว
//   → หัวแถวกลายเป็นคนถัดไป → จอประกาศชื่อคนใหม่ 1 ครั้ง
// จึงประกาศทีละคนตามจังหวะการรับเงินจริง โดยไม่ต้องมีใครกดอะไรเลย
//
// ⚠️ ข้อจำกัดของเบราว์เซอร์: speechSynthesis จะไม่ทำงานจนกว่าหน้าเว็บจะเคย
//    ถูกคลิก/แตะอย่างน้อย 1 ครั้ง (นโยบาย autoplay) — hook คืนค่า needsUnlock
//    ให้จอขึ้นแถบ "แตะเพื่อเปิดเสียง" ครั้งเดียวตอนเปิดจอ
//    ถ้าอยากให้ไม่ต้องแตะเลย เปิด Chrome ด้วย --autoplay-policy=no-user-gesture-required
//    (ดู README หัวข้อ "เสียงเรียกคิว")
import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice } from "./voice";
import type { CallData } from "@/lib/cashier.types";

interface Options {
  /** เปิดเสียงหรือไม่ — จอเดียวในห้องควรเปิด จอที่เหลือปิด กันเสียงซ้อน */
  enabled: boolean;
  /** ระยะถามเซิร์ฟเวอร์ว่าหัวแถวเปลี่ยนหรือยัง (วินาที) */
  refreshSeconds: number;
  /** ข้อความประกาศ — ใส่ชื่อคนไข้เข้าไป */
  buildAnnouncement: (name: string) => string;
  /** ชื่อเสียงที่อยากใช้ (TTS_VOICE / ?voice=) — ใส่แค่บางส่วนของชื่อก็ได้ */
  voiceName?: string;
  /** ความเร็ว 1.0 = ปกติ — จอ รพ. ตั้ง 0.7 ให้ผู้สูงอายุฟังทัน */
  rate?: number;
  /** ระดับเสียงสูง-ต่ำ 1.0 = ปกติ */
  pitch?: number;
}

export function useAnnouncer({
  enabled,
  refreshSeconds,
  buildAnnouncement,
  voiceName,
  rate = 0.7,
  pitch = 1,
}: Options) {
  const [calling, setCalling] = useState<CallData["calling"]>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  // key ของคนที่ประกาศไปแล้ว — กันประกาศซ้ำคนเดิม
  const announced = useRef<Set<string>>(new Set());
  // รอบแรกยังไม่ประกาศ: เปิดจอ/รีเฟรชหน้า ไม่ควรตะโกนชื่อคนที่ยืนอยู่หน้าเคาน์เตอร์แล้ว
  const primed = useRef(false);

  const speak = useCallback(
    (name: string) => {
      if (!("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(buildAnnouncement(name));
      u.lang = "th-TH";
      // จำกัดช่วงที่เบราว์เซอร์รับได้ กันค่าพิมพ์ผิดใน .env ทำให้เสียงเพี้ยนหรือเงียบ
      u.rate = Math.min(2, Math.max(0.5, rate));
      u.pitch = Math.min(2, Math.max(0, pitch));
      u.volume = 1;

      const voice = pickVoice(synth.getVoices(), voiceName);
      if (voice) {
        u.voice = voice;
        // บางเครื่องตั้ง lang ของเสียง Siri เป็น en-US ถ้าไม่ตามให้จะอ่านไทยเป็นอังกฤษ
        if (voice.lang) u.lang = voice.lang;
      }

      // ⚠️ ห้าม synth.cancel() ตรงนี้ — ถ้าเจ้าหน้าที่กดเรียก 2 คนติด ๆ กัน
      //    การ cancel จะไปตัดประกาศคนแรกทิ้งกลางคัน คนนั้นก็ไม่ได้ยินชื่อตัวเอง
      //    ปล่อยให้ต่อคิวพูดเองตามลำดับที่ถูกเรียกจริง
      synth.speak(u);
    },
    [buildAnnouncement, voiceName, rate, pitch],
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/call", { cache: "no-store" });
      if (!res.ok) return;
      const data: CallData = await res.json();
      setCalling(data.calling);

      const head = data.calling;
      if (!head) return;

      if (!primed.current) {
        // รอบแรก: จำไว้ว่าคนนี้ "ถือว่าประกาศแล้ว" โดยไม่ต้องออกเสียง
        primed.current = true;
        announced.current.add(head.key);
        return;
      }

      if (announced.current.has(head.key)) return;
      announced.current.add(head.key);
      if (enabled) speak(head.name);
    } catch {
      // ดึงไม่ได้รอบนี้ = ข้ามไป รอบหน้าค่อยว่ากัน จอไม่ต้องขึ้น error
    }
  }, [enabled, speak]);

  useEffect(() => {
    // รอบแรกยิงใน tick ถัดไป (ไม่เรียกตรง ๆ ใน effect body เพื่อไม่ให้เกิด cascading render)
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, Math.max(5, refreshSeconds) * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [poll, refreshSeconds]);

  // ── โหลดรายชื่อเสียง ────────────────────────────────────────────────────
  // มาแบบ async — Chrome คืน [] ตอนโหลดหน้าแรก ต้องรอ event voiceschanged ก่อน
  // ถ้าไม่รอ pickVoice() จะไม่เจอเสียงสิริในรอบประกาศแรก
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // ── ปลดล็อกเสียง ────────────────────────────────────────────────────────
  // เช็กว่าเบราว์เซอร์ยอมให้พูดหรือยัง ถ้ายังให้จอขึ้นแถบชวนแตะ 1 ครั้ง
  useEffect(() => {
    if (!enabled || !("speechSynthesis" in window)) return;

    let done = false;
    const unlock = () => {
      if (done) return;
      done = true;
      // เรียก getVoices() หลัง gesture แรก เบราว์เซอร์ถึงจะโหลดรายชื่อเสียงไทย
      window.speechSynthesis.getVoices();
      setNeedsUnlock(false);
    };

    // ทดสอบด้วยเสียงเปล่า ๆ — ถ้าเบราว์เซอล็อกอยู่จะไม่มีอะไรเกิดขึ้น
    const probe = new SpeechSynthesisUtterance(" ");
    probe.volume = 0;
    probe.onstart = unlock;
    probe.onend = unlock;
    window.speechSynthesis.speak(probe);

    const t = setTimeout(() => {
      if (!done) setNeedsUnlock(true);
    }, 1200);

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    return () => {
      clearTimeout(t);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [enabled]);

  return { calling, needsUnlock };
}
