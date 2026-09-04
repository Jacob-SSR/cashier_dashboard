// app/voice.ts
// เลือก "เสียง" ที่ใช้ประกาศเรียกคิว
//
// ชื่อเสียงไทยต่างกันไปตามเครื่อง/เบราว์เซอร์ที่เอาไปเปิดจอ:
//   Apple (iPad / Mac / Apple TV ผ่าน Safari) → "Siri", "Kanya"
//   Windows (Chrome / Edge)                   → "Microsoft Premwadee Online", "Pattara"
//   Android / Chrome OS                       → "ภาษาไทย" ของ Google
// จอ TV ที่ รพ. ใช้จึงอาจไม่มีเสียงที่ตั้งไว้ — ต้องไล่ fallback ให้ครบ
// ไม่งั้นจะกลายเป็นเงียบสนิท ซึ่งแย่กว่าได้เสียงที่ไม่ตรงใจ
//
// 👉 เปิด /voices บนเครื่องที่เอาไปต่อจอ เพื่อดูว่าเครื่องนั้นมีเสียงอะไรให้เลือกบ้าง

/** ลำดับความชอบเมื่อไม่ได้ระบุชื่อเสียงมา — สิริมาก่อนตามที่หน้างานเลือก */
const PREFERRED = [
  "siri",       // Apple — เสียงที่หน้างานขอ
  "kanya",      // Apple สำรอง (เสียงไทยตัวเดิมของ macOS/iOS)
  "premwadee",  // Windows 10/11 (Microsoft Premwadee Online)
  "pattara",    // Windows รุ่นเก่า
  "narisa",     // Windows/Edge บางรุ่น
  "achara",
];

const isThai = (v: SpeechSynthesisVoice) =>
  v.lang === "th-TH" || v.lang === "th" || v.lang.toLowerCase().startsWith("th");

/**
 * เลือกเสียงที่ดีที่สุดที่เครื่องนี้มีจริง
 *
 * @param voices  ผลจาก speechSynthesis.getVoices()
 * @param wanted  ชื่อเสียงที่อยากได้ (จาก TTS_VOICE หรือ ?voice=) — เทียบแบบไม่สนตัวพิมพ์
 *                และเป็นแค่ "บางส่วนของชื่อ" ก็พอ เช่น "siri" เจอ "Siri Voice 1 (Thai)"
 * @returns       เสียงที่เลือกได้ หรือ null ถ้าเครื่องไม่มีเสียงไทยเลย (ให้เบราว์เซอร์เลือกเอง)
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  wanted?: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const thai = voices.filter(isThai);
  const byName = (pool: SpeechSynthesisVoice[], needle: string) =>
    pool.find((v) => v.name.toLowerCase().includes(needle.toLowerCase())) ?? null;

  // 1) ชื่อที่ระบุมาเอง — หาในเสียงไทยก่อน แล้วค่อยหาทั้งเครื่อง
  //    (บางเครื่องตั้ง lang ของเสียง Siri เป็น en-US ทั้งที่พูดไทยได้)
  const w = wanted?.trim();
  if (w) {
    const hit = byName(thai, w) ?? byName(voices, w);
    if (hit) return hit;
  }

  // 2) ไล่ตามลำดับความชอบ เฉพาะในเสียงไทย
  for (const name of PREFERRED) {
    const hit = byName(thai, name);
    if (hit) return hit;
  }

  // 3) เสียงไทยตัวไหนก็ได้ที่เครื่องมี — เอาตัว default ของระบบก่อน
  return thai.find((v) => v.default) ?? thai[0] ?? null;
}

/** ชื่อเสียงที่ตั้งไว้ (?voice= ชนะ env) — ใช้ตอนอยากลองสลับเสียงหน้าจอจริง */
export function voiceNameFromUrl(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get("voice") || fallback;
}
