"use client";

// app/QueueBoard.tsx
// จอคิวห้องเก็บเงินสำหรับคนไข้ดู (ออกแบบที่ 55" / 1080p ดูจากระยะ 4–6 เมตร)
//
// ไม่มีอะไรให้กดทั้งจอ — เจ้าหน้าที่ทำงานใน HOSxP ตามปกติ
// จอแค่ตามข้อมูลจาก HOSxP แล้วประกาศชื่อคนที่ถึงคิวให้เอง
//
// ── ผังหน้าจอ ────────────────────────────────────────────────
//   หัวจอ: โลโก้ + ชื่อ รพ.            |  วันที่ + นาฬิกา
//   ┌──────────────────────────┬──────────────────┐
//   │ กำลังเรียกให้เข้ารับบริการ    │ ผู้ที่เรียกไปแล้ว   │
//   │  (เลขคิวใหญ่ + ชื่อ)        │  (ล่าสุดอยู่บน)     │
//   ├──────────────────────────┤                  │
//   │ คิวถัดไป (5 คิว)           │                  │
//   └──────────────────────────┴──────────────────┘
//   ท้ายจอ: ชื่อ รพ. · ระบบเรียกคิวผู้ป่วย
//
// ทุกขนาดคิดเป็น vh → เต็มจอพอดีไม่มี scroll และขยายตามเองบนจอ 4K
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useAnnouncer } from "./useAnnouncer";
import type { BoardData, BoardRow, CallData } from "@/lib/cashier.types";

interface Props {
  initialData: BoardData;
  boardTitle: string;
  /** คำโปรยใต้ชื่อ รพ. */
  boardSubtitle: string;
  rowLimit: number;
  refreshSeconds: number;
  /** เปิดเสียงประกาศบนจอนี้ (ปิดด้วย ?sound=0 ถ้าเปิดหลายจอในห้องเดียวกัน) */
  sound: boolean;
  /** พูดกี่รอบต่อการเรียก 1 ครั้ง (TTS_REPEAT / ?repeat=) */
  ttsRepeat: number;
  /** ข้อความประกาศ ใช้ {ชื่อ} {จุดบริการ} {คิว} (TTS_TEXT / ?say=) */
  ttsText: string;
  /** ประโยคปิดท้าย พูดครั้งเดียวตอนจบ ค่าว่าง = ไม่พูด (TTS_THANKS / ?thanks=) */
  ttsThanks: string;
}

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const pad = (n: number) => String(n).padStart(2, "0");

export default function QueueBoard({
  initialData,
  boardTitle,
  boardSubtitle,
  rowLimit,
  refreshSeconds,
  sound,
  ttsRepeat,
  ttsText,
  ttsThanks,
}: Props) {
  const [data, setData] = useState<BoardData>(initialData);
  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [shortDate, setShortDate] = useState("");
  const [offline, setOffline] = useState(false);

  /**
   * ประกอบประโยคที่ส่งให้เซิร์ฟเวอร์ไปสร้างเสียง
   *
   * รูปแบบเริ่มต้นยกมาจากจอเดิมเป๊ะ ๆ (docs/reference/getDoctorRoomQ.php):
   *   " ขอเชิญ " + CONCAT('คุณ', fname, ' ', lname) + " ที่ " + department + " ค่ะ "
   * ปรับได้ที่ TTS_TEXT / TTS_REPEAT ใน .env ถ้าอยากเปลี่ยนทีหลัง
   */
  const buildAnnouncement = useCallback(
    (row: NonNullable<CallData["calling"]>) => {
      const line = ttsText
        .replaceAll("{ชื่อ}", row.callName || row.name)
        .replaceAll("{name}", row.callName || row.name)
        .replaceAll("{จุดบริการ}", row.dept)
        .replaceAll("{dept}", row.dept)
        .replaceAll("{คิว}", row.queueNo);
      const parts = Array(ttsRepeat).fill(line);
      if (ttsThanks.trim()) parts.push(ttsThanks.trim());
      return parts.join(" ");
    },
    [ttsText, ttsRepeat, ttsThanks],
  );

  const { needsUnlock, unlockSound } = useAnnouncer({
    enabled: sound,
    refreshSeconds,
    buildAnnouncement,
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setClockDate(
        `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()].replace(".", "")} ${d.getFullYear() + 543}`,
      );
      setShortDate(
        `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`,
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
      setData(await res.json());
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

  const called = data.called ?? [];
  const current = called[0] ?? null;   // กำลังเรียกอยู่ตอนนี้
  const history = called.slice(1);     // เรียกไปแล้ว (ใหม่สุดอยู่บน)
  const waiting = data.rows.slice(0, rowLimit);

  return (
    <main className="qb">
      {/* ─── หัวจอ ─────────────────────────────────────────── */}
      <header className="qb-header">
        <div className="qb-brand">
          <span className="qb-logo">
            <Icon name="clinic" />
          </span>
          <div>
            <h1>{boardTitle}</h1>
            {boardSubtitle && <p>{boardSubtitle}</p>}
          </div>
        </div>

        <div className="qb-time">
          <div className="qb-date">
            <Icon name="screening" /> {clockDate}
          </div>
          <div className="qb-clock">
            {clock}
            {offline && <span className="qb-offline" title="เชื่อมต่อไม่ได้" />}
          </div>
        </div>
      </header>

      {/* ─── เนื้อจอ ────────────────────────────────────────── */}
      <div className="qb-body">
        <div className="qb-left">
          {/* กำลังเรียก */}
          {current ? (
            <section className="qb-now" key={current.id}>
              <div className="qb-now-badge">
                <div className="qb-now-label">
                  <Icon name="sound" /> กำลังเรียกให้เข้ารับบริการ
                </div>
                <div className="qb-now-no">{current.queueNo || "-"}</div>
              </div>

              <div className="qb-now-main">
                <div className="qb-now-name">{current.name}</div>
                <div className="qb-now-dept">
                  <Icon name="medicine" /> {current.dept}
                </div>
                <div className="qb-now-meta">
                  <span>
                    <Icon name="screening" /> เวลาเรียกคิว
                    <b>{current.time} น.</b>
                  </span>
                  <span className="qb-sep" />
                  <span>
                    <Icon name="card" /> วันที่
                    <b>{shortDate}</b>
                  </span>
                </div>
              </div>

              <div className="qb-now-cta">
                <span className="qb-pulse" />
                เชิญเข้ารับบริการ
              </div>
            </section>
          ) : (
            <section className="qb-now qb-now-empty">
              <div className="qb-empty-icon">
                <Icon name="cashier" />
              </div>
              <div>
                <div className="qb-empty-title">ยังไม่มีการเรียกคิว</div>
                <div className="qb-empty-sub">
                  ชื่อจะขึ้นเองเมื่อเจ้าหน้าที่กดเรียกคิวในระบบ
                </div>
              </div>
            </section>
          )}

          {/* คิวถัดไป */}
          <section className="qb-next">
            <div className="qb-sec-head">
              <span className="qb-sec-icon">
                <Icon name="screening" />
              </span>
              <h2>คิวถัดไป</h2>
              <span className="qb-chip">{data.waiting} คิว</span>
            </div>

            <div className="qb-next-list">
              {waiting.length === 0 && (
                <div className="qb-next-none">ไม่มีคิวรอ</div>
              )}
              {waiting.map((row: BoardRow) => (
                <div className="qb-next-row" key={row.id}>
                  <div className="qb-next-no">
                    <span>ลำดับที่</span>
                    <b>{row.queueNo || "-"}</b>
                  </div>

                  <div className="qb-next-main">
                    <div className="qb-next-name">{row.name}</div>
                    <div className="qb-next-dept">
                      <Icon name="medicine" /> {row.dept}
                    </div>
                  </div>

                  <div className="qb-next-time">
                    <Icon name="screening" /> ส่งมา <b>{row.time} น.</b>
                  </div>

                  <span className="qb-tag">รอเรียก</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ─── ผู้ที่เรียกไปแล้ว ──────────────────────────── */}
        <aside className="qb-side">
          <div className="qb-sec-head">
            <span className="qb-sec-icon qb-sec-icon-done">
              <Icon name="clinic" />
            </span>
            <h2>ผู้ที่เรียกไปแล้ว</h2>
            <span className="qb-chip">{history.length} ราย</span>
          </div>

          <div className="qb-done-list">
            {history.length === 0 && (
              <div className="qb-next-none">ยังไม่มี</div>
            )}
            {history.map((row) => (
              <div className="qb-done-row" key={row.id}>
                <div className="qb-done-no">{row.queueNo || "-"}</div>
                <div className="qb-done-main">
                  <div className="qb-done-name">{row.name}</div>
                  <div className="qb-done-dept">
                    <Icon name="medicine" /> {row.dept}
                  </div>
                </div>
                <div className="qb-done-time">{row.time} น.</div>
              </div>
            ))}
          </div>

          <div className="qb-thanks">
            <div className="qb-thanks-head">
              <Icon name="pediatrics" /> ขอบคุณที่ใช้บริการ
            </div>
            <p>หากมีอาการผิดปกติ กรุณาแจ้งเจ้าหน้าที่ทันทีนะครับ</p>
          </div>
        </aside>
      </div>

      {/* ─── ท้ายจอ ────────────────────────────────────────── */}
      <footer className="qb-footer">
        <span>
          <Icon name="clinic" /> {boardTitle}
        </span>
        <span className="qb-foot-sep" />
        <span>
          <Icon name="screening" /> ระบบเรียกคิวผู้ป่วย
        </span>
        <span className="qb-foot-right">
          {data.source === "demo" && <b className="qb-demo">โหมดสาธิต</b>}
          ดูแลสุขภาพ…ไปด้วยกัน
        </span>
      </footer>

      {needsUnlock && (
        /* ต้องเป็น <button> จริงและโฟกัสไว้ให้เอง — เบราว์เซอร์ของทีวีเดินด้วย
           ปุ่มทิศทาง ปุ่ม OK จะ "กด" ได้เฉพาะสิ่งที่โฟกัสอยู่ */
        <button type="button" className="qb-unlock" autoFocus onClick={unlockSound}>
          <Icon name="sound" />
          <span>
            กด <b>ปุ่ม OK ตรงกลางรีโมต</b> หนึ่งครั้ง เพื่อเปิดเสียงเรียกคิว
          </span>
        </button>
      )}
    </main>
  );
}
