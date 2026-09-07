"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "../Icon";
import { pickVoice } from "../voice";

const SAMPLE = "เชิญ นางสาวสุภาพร ชำระเงินที่ห้องเก็บเงิน";

const FEMALE_KEYWORDS = [
  "female",
  "woman",
  "girl",
  "หญิง",
  "premwadee",
  "kanya",
  "siri",
];

function isThaiVoice(v: SpeechSynthesisVoice) {
  return v.lang.toLowerCase().startsWith("th");
}

function isLikelyFemaleVoice(v: SpeechSynthesisVoice) {
  const name = v.name.toLowerCase();

  return FEMALE_KEYWORDS.some((keyword) =>
    name.includes(keyword.toLowerCase())
  );
}

/* =========================================================
   Speech Synthesis support
   ========================================================= */

function subscribeSpeechSynthesis(callback: () => void) {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return () => { };
  }

  window.speechSynthesis.addEventListener(
    "voiceschanged",
    callback
  );

  return () => {
    window.speechSynthesis.removeEventListener(
      "voiceschanged",
      callback
    );
  };
}

function getSpeechSynthesisSupport() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  );
}

function getServerSpeechSynthesisSupport() {
  // สำคัญ:
  // Server ต้องได้ค่าเดียวกับ Client ใน hydration รอบแรก
  return false;
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [wanted, setWanted] = useState("Siri");
  const [speaking, setSpeaking] = useState<string | null>(null);

  /* =========================================================
     ตรวจ Browser รองรับ Speech Synthesis หรือไม่

     ใช้ useSyncExternalStore เพื่อป้องกัน
     Hydration mismatch
     ========================================================= */

  const supported = useSyncExternalStore(
    subscribeSpeechSynthesis,
    getSpeechSynthesisSupport,
    getServerSpeechSynthesisSupport
  );

  /* =========================================================
     โหลดเสียงจากเครื่อง
     ========================================================= */

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();

      const unique = Array.from(
        new Map(
          list.map((voice) => [
            `${voice.name}-${voice.lang}`,
            voice,
          ])
        ).values()
      );

      setVoices(unique);
    };

    // บาง Browser มีเสียงทันที
    loadVoices();

    // บาง Browser โหลดเสียงทีหลัง
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, []);

  /* =========================================================
     ทดสอบเสียง
     ========================================================= */

  const test = useCallback(
    (voice?: SpeechSynthesisVoice) => {
      if (typeof window === "undefined") {
        return;
      }

      if (!("speechSynthesis" in window)) {
        alert("Browser นี้ไม่รองรับ Speech Synthesis");
        return;
      }

      const u = new SpeechSynthesisUtterance(SAMPLE);

      u.lang = voice?.lang || "th-TH";

      // ความเร็ว
      u.rate = 0.30;

      // ความสูงเสียง
      u.pitch = 0.05;

      // ระดับเสียง
      // SpeechSynthesis volume รองรับ 0.0 - 1.0
      u.volume = 1.0;

      if (voice) {
        u.voice = voice;

        setSpeaking(`${voice.name}-${voice.lang}`);
      } else {
        setSpeaking("default");
      }

      u.onend = () => {
        setSpeaking(null);
      };

      u.onerror = () => {
        setSpeaking(null);
      };

      // หยุดเสียงเดิมก่อน
      window.speechSynthesis.cancel();

      // หน่วงเล็กน้อยเพื่อแก้ปัญหา Browser บางตัว
      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          "speechSynthesis" in window
        ) {
          window.speechSynthesis.speak(u);
        }
      }, 50);
    },
    []
  );

  /* =========================================================
     หยุดเสียง
     ========================================================= */

  const stop = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeaking(null);
  }, []);

  /* =========================================================
     เสียงไทย
     ========================================================= */

  const thai = useMemo(() => {
    return voices.filter(isThaiVoice);
  }, [voices]);

  /* =========================================================
     เสียงผู้หญิง
     ========================================================= */

  const thaiFemale = useMemo(() => {
    return thai.filter(isLikelyFemaleVoice);
  }, [thai]);

  /* =========================================================
     ภาษาอื่น
     ========================================================= */

  const others = useMemo(() => {
    return voices.filter((v) => !isThaiVoice(v));
  }, [voices]);

  /* =========================================================
     เสียงที่เลือก
     ========================================================= */

  const chosen = useMemo(() => {
    return pickVoice(voices, wanted);
  }, [voices, wanted]);

  const chosenIsFemale = chosen
    ? isLikelyFemaleVoice(chosen)
    : false;

  /* =========================================================
     Render
     ========================================================= */

  return (
    <main className="vx">
      <h1>เสียงที่เครื่องนี้มี</h1>

      <p className="vx-sub">
        รายชื่อนี้เป็นของ{" "}
        <b>เครื่องที่เปิดหน้านี้</b>{" "}
        ไม่ใช่ของเซิร์ฟเวอร์
        <br />
        ต้องเปิดหน้านี้บนเครื่องที่ต่อกับจอ TV จริง ๆ
        ถึงจะเห็นเสียงที่ใช้ได้จริง
      </p>

      {/* =====================================================
          Browser ไม่รองรับ
          ===================================================== */}

      {!supported && (
        <div className="vx-warn">
          <b>Browser นี้ไม่รองรับ Speech Synthesis</b>

          <br />

          กรุณาใช้ Chrome, Edge หรือ Browser
          ที่รองรับ Web Speech API
        </div>
      )}

      {/* =====================================================
          เสียงที่เลือก
          ===================================================== */}

      <div className="vx-box">
        <label htmlFor="vx-want">
          ชื่อเสียงที่ต้องการ (TTS_VOICE)
        </label>

        <input
          id="vx-want"
          value={wanted}
          onChange={(e) => setWanted(e.target.value)}
          placeholder="เช่น Siri, Premwadee, Kanya"
        />

        <p>
          จอจะเลือกใช้ →{" "}
          {chosen ? (
            <>
              <b>{chosen.name}</b>{" "}
              <span className="vx-lang">
                ({chosen.lang})
              </span>

              {chosenIsFemale && (
                <span className="vx-tag">
                  เสียงผู้หญิง
                </span>
              )}
            </>
          ) : (
            <b className="vx-none">
              ไม่พบเสียงที่ต้องการ
            </b>
          )}
        </p>

        <div className="vx-actions">
          <button
            type="button"
            onClick={() => test(chosen ?? undefined)}
            disabled={!supported || !chosen}
          >
            <Icon name="play" />

            {speaking
              ? "กำลังพูด..."
              : "ฟังตัวอย่าง"}
          </button>

          <button
            type="button"
            onClick={stop}
            disabled={!speaking}
          >
            หยุด
          </button>
        </div>
      </div>

      {/* =====================================================
          เสียงผู้หญิง
          ===================================================== */}

      <h2>
        เสียงผู้หญิงที่ตรวจพบ ({thaiFemale.length})
      </h2>

      {thaiFemale.length === 0 ? (
        <div className="vx-warn">
          <b>
            ไม่พบเสียงผู้หญิงภาษาไทยจากชื่อเสียง
          </b>

          <br />
          <br />

          Browser ไม่สามารถบอกเพศของเสียงได้โดยตรง
          รายการนี้จึงเป็นการเดาจากชื่อเสียงเท่านั้น

          <br />
          <br />

          ถ้ามีเสียงไทยอยู่ด้านล่าง
          ให้กดฟังทีละตัวเพื่อเลือกเสียงที่ต้องการ
        </div>
      ) : (
        <ul>
          {thaiFemale.map((v) => {
            const key = `${v.name}-${v.lang}`;
            const active = speaking === key;

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => test(v)}
                  disabled={!supported}
                  aria-label={`ฟัง ${v.name}`}
                >
                  <Icon name="play" />
                </button>

                <span className="vx-name">
                  {v.name}
                </span>

                <span className="vx-lang">
                  {v.lang}
                </span>

                {v.default && (
                  <span className="vx-tag">
                    ค่าเริ่มต้น
                  </span>
                )}

                {active && (
                  <span className="vx-speaking">
                    กำลังพูด...
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* =====================================================
          เสียงไทยทั้งหมด
          ===================================================== */}

      <h2>
        เสียงไทยทั้งหมด ({thai.length})
      </h2>

      {thai.length === 0 ? (
        <p className="vx-warn">
          <b>
            เครื่องนี้ไม่มีเสียงไทยเลย
          </b>

          <br />
          <br />

          ต้องติดตั้งเสียงภาษาไทยของ OS ก่อน

          <br />
          <br />

          Windows:
          <br />

          Settings → Time &amp; language → Speech
          → Add voices → ไทย
        </p>
      ) : (
        <ul>
          {thai.map((v) => {
            const key = `${v.name}-${v.lang}`;
            const active = speaking === key;
            const female = isLikelyFemaleVoice(v);

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => test(v)}
                  disabled={!supported}
                  aria-label={`ฟัง ${v.name}`}
                >
                  <Icon name="play" />
                </button>

                <span className="vx-name">
                  {v.name}
                </span>

                <span className="vx-lang">
                  {v.lang}
                </span>

                {female && (
                  <span className="vx-tag">
                    ผู้หญิง*
                  </span>
                )}

                {v.default && (
                  <span className="vx-tag">
                    ค่าเริ่มต้น
                  </span>
                )}

                {active && (
                  <span className="vx-speaking">
                    กำลังพูด...
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="vx-sub">
        * ผู้หญิงเป็นการตรวจจากชื่อเสียง
        ไม่ใช่ข้อมูลเพศที่ Browser รับรองโดยตรง
      </p>

      {/* =====================================================
          ภาษาอื่น
          ===================================================== */}

      <details>
        <summary>
          เสียงภาษาอื่น ({others.length})
        </summary>

        <ul>
          {others.map((v) => {
            const key = `${v.name}-${v.lang}`;
            const active = speaking === key;

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => test(v)}
                  disabled={!supported}
                  aria-label={`ฟัง ${v.name}`}
                >
                  <Icon name="play" />
                </button>

                <span className="vx-name">
                  {v.name}
                </span>

                <span className="vx-lang">
                  {v.lang}
                </span>

                {v.default && (
                  <span className="vx-tag">
                    ค่าเริ่มต้น
                  </span>
                )}

                {active && (
                  <span className="vx-speaking">
                    กำลังพูด...
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </details>

      {/* =====================================================
          วิธีตั้งค่า
          ===================================================== */}

      <div className="vx-box">
        <h3>วิธีตั้งค่าเสียง</h3>

        <p>
          <b>1.</b> กดฟังเสียงด้านบน
        </p>

        <p>
          <b>2.</b> เลือกเสียงผู้หญิงที่ต้องการ
        </p>

        <p>
          <b>3.</b> เอาชื่อเสียงไปใส่ใน{" "}
          <code>TTS_VOICE</code>
        </p>

        <pre>{`TTS_VOICE=ชื่อเสียง`}</pre>

        <p>
          <b>4.</b> Build ใหม่
        </p>

        <pre>{`docker compose up -d --build`}</pre>

        <p>
          <b>5.</b> หรือทดลองเสียงสดผ่าน URL
        </p>

        <pre>{`/?voice=ชื่อเสียง`}</pre>
      </div>
    </main>
  );
}