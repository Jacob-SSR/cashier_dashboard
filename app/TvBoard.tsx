"use client";

// app/TvBoard.tsx
// จอคิวสำหรับทีวี (ออกแบบที่ 55" / 1080p ดูจากระยะ 4–6 เมตร)
// ทุกขนาดคิดเป็น vh → เต็มจอพอดีไม่มี scroll และขยายตามเองบนจอ 4K
import { useCallback, useEffect, useState } from "react";
import { deptStyle } from "./dept";
import type { TvData, TvRow } from "@/lib/cashier.types";

interface Props {
  initialData: TvData;
  hospitalName: string;
  rowLimit: number;
  /** จำนวนคิวต่อ 1 ช่อง — 10 คิว ช่องละ 5 = 2 ช่อง */
  rowsPerColumn: number;
  refreshSeconds: number;
}

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const pad = (n: number) => String(n).padStart(2, "0");

export default function TvBoard({
  initialData,
  hospitalName,
  rowLimit,
  rowsPerColumn,
  refreshSeconds,
}: Props) {
  const [data, setData] = useState<TvData>(initialData);
  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setClockDate(
        `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cashier/tv", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setOffline(false);
    } catch {
      // จอ TV ไม่มีคนดูแล — ค้างข้อมูลเดิมไว้ดีกว่าจอว่าง แล้วขึ้นจุดแดงเตือน
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, Math.max(5, refreshSeconds) * 1000);
    return () => clearInterval(id);
  }, [refresh, refreshSeconds]);

  // เติมช่องว่างให้ครบจำนวนแถว เพื่อให้ตำแหน่งแถวบนจอนิ่ง ไม่กระโดดขึ้นลง
  const slots: (TvRow | null)[] = Array.from(
    { length: rowLimit },
    (_, i) => data.rows[i] ?? null,
  );

  // ตัดเป็นช่อง ๆ ช่องละ rowsPerColumn (10 คิว ช่องละ 5 = 2 ช่อง)
  const columns: (TvRow | null)[][] = [];
  for (let i = 0; i < slots.length; i += rowsPerColumn) {
    columns.push(slots.slice(i, i + rowsPerColumn));
  }

  const more = Math.max(0, data.waiting - data.rows.length);

  return (
    <main className="tv">
      <header className="tv-header">
        <div className="tv-title">
          <span className="tv-title-icon">🏦</span>
          <div>
            <h1>ห้องเก็บเงินแดง</h1>
            <p>{hospitalName}</p>
          </div>
        </div>

        <div className="tv-clock">
          <div className="tv-clock-time">
            {clock}
            {offline && <span className="tv-offline" title="เชื่อมต่อไม่ได้" />}
          </div>
          <div className="tv-clock-date">{clockDate}</div>
        </div>
      </header>

      <div className="tv-columns">
        {columns.map((col, c) => (
          <div className="tv-column" key={c}>
            {col.map((row, i) => {
              const seq = c * rowsPerColumn + i + 1;
              if (!row)
                return <div key={`empty-${seq}`} className="tv-row tv-row-empty" />;

              const serving = row.status === "กำลังชำระ";
              return (
                <div
                  key={row.id}
                  className={`tv-row${serving ? " tv-row-serving" : ""}`}
                >
                  <span className="tv-seq">{seq}</span>

                  <div className="tv-main">
                    <div className="tv-name">{row.name}</div>
                    <div className="tv-meta">
                      <span className="tv-meta-time">{row.time}</span>
                      <span>·</span>
                      <span>
                        {deptStyle(row.dept).icon} {row.dept}
                      </span>
                      <span>·</span>
                      <span
                        className={
                          row.route === "มียา" ? "tv-route tv-route-drug" : "tv-route"
                        }
                      >
                        {row.route === "มียา" ? "→ จ่ายแล้วรับยา" : "→ จ่ายแล้วกลับบ้าน"}
                      </span>
                    </div>
                  </div>

                  <div className="tv-right">
                    <div className="tv-amount">
                      {row.amount.toLocaleString("th-TH")}
                      <span>฿</span>
                    </div>
                    {serving ? (
                      <span className="tv-status tv-status-serving">
                        <span className="pulse-dot" />
                        เชิญชำระเงิน
                      </span>
                    ) : (
                      <span className="tv-status tv-status-wait">รอเรียก</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <footer className="tv-footer">
        <span>
          รอชำระทั้งหมด <b>{data.waiting}</b> ราย
          {more > 0 && <> · ยังไม่ขึ้นจออีก <b>{more}</b> ราย</>}
        </span>
        <span>ชำระแล้ววันนี้ <b>{data.done}</b> ราย</span>
        {data.source === "demo" && <span className="tv-demo">โหมดสาธิต</span>}
      </footer>
    </main>
  );
}
