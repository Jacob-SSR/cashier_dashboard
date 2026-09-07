"use client";

// app/QueueBoard.tsx
// จอคิวห้องการเงินสำหรับคนไข้ดู (ออกแบบที่ 55" / 1080p ดูจากระยะ 4–6 เมตร)
//
// ไม่มีอะไรให้กดทั้งจอ — เจ้าหน้าที่ทำงานใน HOSxP ตามปกติ
// จอแค่ตามข้อมูลจาก HOSxP แล้วประกาศชื่อคนที่ถึงคิวให้เอง
//
// ทุกขนาดคิดเป็น vh → เต็มจอพอดีไม่มี scroll และขยายตามเองบนจอ 4K
import { useCallback, useEffect, useState } from "react";
import { deptStyle } from "./dept";
import { Icon } from "./Icon";
import { useAnnouncer } from "./useAnnouncer";
import type { BoardData, BoardRow } from "@/lib/cashier.types";

interface Props {
  initialData: BoardData;
  boardTitle: string;
  rowLimit: number;
  /** จำนวนคิวต่อ 1 ช่อง — 10 คิว ช่องละ 5 = 2 ช่อง */
  rowsPerColumn: number;
  refreshSeconds: number;
  /** เปิดเสียงประกาศบนจอนี้ (ปิดด้วย ?sound=0 ถ้าเปิดหลายจอในห้องเดียวกัน) */
  sound: boolean;
  /** ชื่อเสียงที่ใช้ประกาศ (TTS_VOICE / ?voice=) */
  voiceName: string;
  /** ความเร็วเสียง 1.0 = ปกติ, ต่ำกว่านั้น = ช้าลง (TTS_RATE / ?rate=) */
  ttsRate: number;
  /** ระดับเสียงสูง-ต่ำ (TTS_PITCH / ?pitch=) */
  ttsPitch: number;
  /** พูดกี่รอบต่อการเรียก 1 ครั้ง (TTS_REPEAT / ?repeat=) */
  ttsRepeat: number;
  /** ข้อความประกาศ ใช้ {ชื่อ} แทนตำแหน่งชื่อคนไข้ (TTS_TEXT / ?say=) */
  ttsText: string;
  /** ประโยคปิดท้าย พูดครั้งเดียวตอนจบ ค่าว่าง = ไม่พูด (TTS_THANKS / ?thanks=) */
  ttsThanks: string;
}

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * รอมากี่นาทีแล้ว — คิดจาก "เวลาส่ง" (HH:MM) เทียบกับนาฬิกาของเครื่องที่เปิดจอ
 * จอเดิมมีช่อง "เวลารอ" แต่เป็นเลขปลอม (180 × ลำดับ ÷ 60) อันนี้ของจริง
 * คืน null เมื่อไม่มีเวลา หรือเวลาเพี้ยนไปอนาคต (นาฬิกาเครื่องไม่ตรง/ข้ามเที่ยงคืน)
 */
function waitedMinutes(hhmm: string, now: Date): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return null;
  const mins =
    now.getHours() * 60 + now.getMinutes() - (Number(m[1]) * 60 + Number(m[2]));
  return mins >= 0 && mins < 24 * 60 ? mins : null;
}

/** "รอ 8 นาที" / "รอ 1 ชม. 12 นาที" — อ่านจากท้ายห้องต้องสั้นและเข้าใจทันที */
function waitedLabel(mins: number): string {
  if (mins < 1) return "เพิ่งส่งมา";
  if (mins < 60) return `รอ ${mins} นาที`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? `รอ ${h} ชม.` : `รอ ${h} ชม. ${r} นาที`;
}

export default function QueueBoard({
  initialData,
  boardTitle,
  rowLimit,
  rowsPerColumn,
  refreshSeconds,
  sound,
  voiceName,
  ttsRate,
  ttsPitch,
  ttsRepeat,
  ttsText,
  ttsThanks,
}: Props) {
  const [data, setData] = useState<BoardData>(initialData);
  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  // เวลาปัจจุบันแบบ Date — ใช้คำนวณ "รอมากี่นาที" ให้เดินตามนาฬิกาไปเอง
  const [now, setNow] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);

  /**
   * ประกอบประโยคที่จะให้เสียงอ่าน
   *
   * เว้นจังหวะด้วยจุดไข่ปลา — เครื่องอ่านจะหยุดหายใจตรงนั้น ทำให้แต่ละรอบ
   * ไม่ติดกันเป็นพรืด คนไข้ที่นั่งอยู่ไกลจับใจความได้ทัน
   * ปรับข้อความ/จำนวนรอบได้ที่ TTS_TEXT / TTS_REPEAT ใน .env
   */
  const buildAnnouncement = useCallback(
    (name: string) => {
      const line = ttsText.replaceAll("{ชื่อ}", name).replaceAll("{name}", name);
      const parts = Array(ttsRepeat).fill(line);
      // ประโยคปิดท้ายพูดครั้งเดียว ไม่ซ้ำตามรอบ
      if (ttsThanks.trim()) parts.push(ttsThanks.trim());
      return parts.join(" . . . ");
    },
    [ttsText, ttsRepeat, ttsThanks],
  );

  // ประกาศชื่อคนที่ถึงคิวเอง ไม่ต้องมีใครกด
  const { needsUnlock, unlockSound } = useAnnouncer({
    enabled: sound,
    refreshSeconds,
    buildAnnouncement,
    voiceName,
    rate: ttsRate,
    pitch: ttsPitch,
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setClockDate(
        `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: BoardData = await res.json();
      setData(json);
      setOffline(false);
    } catch {
      // จอไม่มีคนดูแล — ค้างข้อมูลเดิมไว้ดีกว่าจอว่าง แล้วขึ้นจุดแดงเตือน
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, Math.max(5, refreshSeconds) * 1000);
    return () => clearInterval(id);
  }, [refresh, refreshSeconds]);

  // "เรียกคิว" มาจาก sd_queue_calling ส่วน "คิวรอ" คือคนที่ยังไม่ถูกเรียก
  // ทั้งสองชุดแยกกันมาจาก server แล้ว ไม่ต้องตัดหัวแถวออกเองอีก
  const called = data.called ?? [];
  const waiting = data.rows;

  // เติมช่องว่างให้ครบจำนวนแถว เพื่อให้ตำแหน่งแถวบนจอนิ่ง ไม่กระโดดขึ้นลง
  const slots: (BoardRow | null)[] = Array.from(
    { length: rowLimit },
    (_, i) => waiting[i] ?? null,
  );

  // ตัดเป็นช่อง ๆ ช่องละ rowsPerColumn (10 คิว ช่องละ 5 = 2 ช่อง)
  const columns: (BoardRow | null)[][] = [];
  for (let i = 0; i < slots.length; i += rowsPerColumn) {
    columns.push(slots.slice(i, i + rowsPerColumn));
  }

  const more = Math.max(0, data.waiting - data.rows.length);

  return (
    <main className="tv">
      <header className="tv-header">
        <div className="tv-title">
          <span className="tv-title-icon">
            <Icon name="cashier" />
          </span>
          <h1>{boardTitle}</h1>
        </div>

        <div className="tv-clock">
          <div className="tv-clock-time">
            {clock}
            {offline && <span className="tv-offline" title="เชื่อมต่อไม่ได้" />}
          </div>
          <div className="tv-clock-date">{clockDate}</div>
        </div>
      </header>

      {/* ─── เรียกคิว — คนที่ถึงคิวตอนนี้ (ล่าสุดอยู่บน) ─── */}
      {called.length > 0 && (
        <section className="tv-calling">
          <div className="tv-section-label">
            <span>เรียกคิว</span>
            <span className="tv-section-hint">เชิญมาที่ช่องรับเงิน</span>
          </div>
          <div className="tv-calling-list">
            {called.map((c, i) => (
              <div
                key={c.id}
                className={i === 0 ? "tv-calling-row" : "tv-calling-row tv-calling-row-prev"}
              >
                <span className="tv-calling-seq">{c.queueNo || "-"}</span>

                <div className="tv-calling-main">
                  <div className="tv-calling-name">{c.name}</div>
                  {/* ⚠️ แผนกในส่วนนี้คนละความหมายกับในคิวรอ
                      คิวรอ  = แผนกที่ "ส่งคนไข้มา" (ovst.last_dep)
                      เรียกคิว = จุดที่ "ต้องเดินไป" (kskdepartment ของจุดที่กดเรียก)
                      ถ้าใช้คำว่า "มาจาก" เหมือนกันทั้งสองที่ คนไข้จะเข้าใจผิดทันที */}
                  <div className="tv-calling-meta">
                    <span className="tv-meta-label">เรียก</span>
                    <span className="tv-meta-time">{c.time}</span>
                    <span aria-hidden>·</span>
                    <span className="tv-meta-dept">
                      <Icon name={deptStyle(c.dept).icon} />
                      <span className="tv-meta-label">ไปที่</span> {c.dept}
                    </span>
                  </div>
                </div>

                <span className="tv-calling-at">
                  {i === 0 ? (
                    <>
                      <span className="pulse-dot" /> เชิญชำระเงิน
                    </>
                  ) : (
                    "เรียกไปแล้ว"
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="tv-section-label tv-section-label-wait">
        <span>คิวรอ</span>
        {data.waiting > 0 && (
          <span className="tv-section-count">{data.waiting} คน</span>
        )}
      </div>

      {waiting.length === 0 ? (
        <div className="tv-empty">
          <div className="tv-empty-icon">
            <Icon name="cashier" />
          </div>
          <div className="tv-empty-title">ไม่มีคิวรอ</div>
          <div className="tv-empty-sub">
            รายชื่อจะขึ้นเองเมื่อมีผู้ป่วยถูกส่งมาห้องเก็บเงิน
          </div>
        </div>
      ) : (
      <div className="tv-columns">
        {columns.map((col, c) => (
          <div className="tv-column" key={c}>
            {col.map((row, i) => {
              const seq = c * rowsPerColumn + i + 1;
              if (!row)
                return <div key={`empty-${seq}`} className="tv-row tv-row-empty" />;

              const waited = now ? waitedMinutes(row.time, now) : null;

              return (
                <div key={row.id} className="tv-row">
                  {/* เลขคิวจริงจาก HOSxP (ovst.oqueue) — ไม่มีเลขคิวค่อยใช้ลำดับบนจอ */}
                  <span className="tv-seq">
                    <span className="tv-seq-label">คิว</span>
                    <span className="tv-seq-no">{row.queueNo || seq}</span>
                  </span>

                  <div className="tv-main">
                    <div className="tv-name">{row.name}</div>
                    <div className="tv-meta">
                      <span className="tv-meta-label">ส่งมา</span>
                      <span className="tv-meta-time">{row.time}</span>
                      <span aria-hidden>·</span>
                      <span className="tv-meta-dept">
                        <Icon name={deptStyle(row.dept).icon} />
                        <span className="tv-meta-label">จาก</span> {row.dept}
                      </span>
                    </div>
                  </div>

                  <div className="tv-right">
                    {/* คนไข้อยากรู้ที่สุดคือ "อีกกี่คิวถึงเรา" กับ "รอมานานแค่ไหนแล้ว" */}
                    <span className="tv-turn">ที่ {seq}</span>
                    {waited !== null && (
                      <span className="tv-waited">{waitedLabel(waited)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      )}

      {needsUnlock && (
        /* ต้องเป็น <button> จริงและโฟกัสไว้ให้เอง — เบราว์เซอร์ของทีวีเดินด้วย
           ปุ่มทิศทาง ปุ่ม OK จะ "กด" ได้เฉพาะสิ่งที่โฟกัสอยู่ ถ้าเป็น <div> เฉย ๆ
           กด OK แล้วจะไม่เกิดอะไรขึ้นเลย */
        <button
          type="button"
          className="tv-unlock"
          autoFocus
          onClick={unlockSound}
        >
          <Icon name="sound" />
          <span>
            กด <b>ปุ่ม OK ตรงกลางรีโมต</b> หนึ่งครั้ง เพื่อเปิดเสียงเรียกคิว
          </span>
        </button>
      )}

      <footer className="tv-footer">
        <span>
          รอเรียกทั้งหมด <b>{data.waiting}</b> ราย
          {more > 0 && <> · ยังไม่ขึ้นจออีก <b>{more}</b> ราย</>}
        </span>
        <span>เรียกไปแล้ววันนี้ <b>{data.done}</b> ราย</span>
        {data.source === "demo" && <span className="tv-demo">โหมดสาธิต</span>}
      </footer>
    </main>
  );
}
