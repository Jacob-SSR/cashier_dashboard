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
  "siri", // Apple — เสียงที่หน้างานขอ
  "kanya", // Apple สำรอง (เสียงไทยตัวเดิมของ macOS/iOS)
  "premwadee", // Windows 10/11 (Microsoft Premwadee Online)
  "pattara", // Windows รุ่นเก่า
  "narisa", // Windows/Edge บางรุ่น
  "achara",
];

const isThai = (v: SpeechSynthesisVoice) =>
  v.lang === "th-TH" ||
  v.lang === "th" ||
  v.lang.toLowerCase().startsWith("th");

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
): SpeechSynthesisVoice | undefined {
  if (!voices.length) {
    return undefined;
  }

  const thai = voices.filter((v) => v.lang.toLowerCase().startsWith("th"));

  if (!thai.length) {
    return undefined;
  }

  // ============================
  // 1. หาชื่อตรงกันก่อน
  // ============================

  if (wanted?.trim()) {
    const target = wanted.trim().toLowerCase();

    const exact = thai.find((v) => v.name.toLowerCase() === target);

    if (exact) {
      return exact;
    }

    // รองรับการพิมพ์แค่บางส่วน
    const partial = thai.find((v) => v.name.toLowerCase().includes(target));

    if (partial) {
      return partial;
    }
  }

  // ============================
  // 2. หาเสียงที่น่าจะเป็นผู้หญิง
  // ============================

  const femaleKeywords = [
    "female",
    "woman",
    "girl",
    "หญิง",
    "premwadee",
    "kanya",
    "siri",
  ];

  const female = thai.find((v) => {
    const name = v.name.toLowerCase();

    return femaleKeywords.some((keyword) =>
      name.includes(keyword.toLowerCase()),
    );
  });

  if (female) {
    return female;
  }

  // ============================
  // 3. ถ้าไม่มี ใช้เสียงไทยตัวแรก
  // ============================

  return thai[0];
}

/** ชื่อเสียงที่ตั้งไว้ (?voice= ชนะ env) — ใช้ตอนอยากลองสลับเสียงหน้าจอจริง */
export function voiceNameFromUrl(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get("voice") || fallback;
}
