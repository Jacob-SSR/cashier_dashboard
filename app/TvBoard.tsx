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

      <div className="tv-colhead">
        <span className="tv-c-seq">คิว</span>
        <span className="tv-c-time">เวลา</span>
        <span className="tv-c-name">ชื่อ</span>
        <span className="tv-c-dept">แผนกที่ส่ง</span>
        <span className="tv-c-amount">ยอดชำระ (฿)</span>
        <span className="tv-c-status">สถานะ</span>
      </div>

      <div className="tv-rows">
        {slots.map((row, i) => {
          if (!row) return <div key={`empty-${i}`} className="tv-row tv-row-empty" />;
          const ds = deptStyle(row.dept);
          const serving = row.status === "กำลังชำระ";
          return (
            <div key={row.id} className={`tv-row${serving ? " tv-row-serving" : ""}`}>
              <span className="tv-c-seq">{i + 1}</span>
              <span className="tv-c-time">{row.time}</span>
              <span className="tv-c-name">{row.name}</span>
              <span className="tv-c-dept">
                <span className={`tv-dept ${ds.cls}`}>
                  {ds.icon} {row.dept}
                </span>
              </span>
              <span className="tv-c-amount">{row.amount.toLocaleString("th-TH")}</span>
              <span className="tv-c-status">
                {serving ? (
                  <span className="tv-status tv-status-serving">
                    <span className="pulse-dot" />
                    เชิญชำระเงิน
                  </span>
                ) : (
                  <span className="tv-status tv-status-wait">รอเรียก</span>
                )}
              </span>
            </div>
          );
        })}
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
