"use client";

// app/CallDisplay.tsx
// จอ "เรียกชื่อ" เต็มจอ — ขึ้นชื่อคนที่ถึงคิวตัวใหญ่ ๆ
// ตามข้อมูลจาก HOSxP เอง ไม่ต้องมีใครกดส่งชื่อมาให้
import { useCallback } from "react";
import { useAnnouncer } from "./useAnnouncer";
import { Icon } from "./Icon";

interface Props {
  hospitalName: string;
  refreshSeconds: number;
  sound: boolean;
}

export default function CallDisplay({
  hospitalName,
  refreshSeconds,
  sound,
}: Props) {
  const buildAnnouncement = useCallback(
    (name: string) =>
      `เชิญ ${name} ชำระเงินที่ห้องเก็บเงิน . . ` +
      `เชิญ ${name} ชำระเงินที่ห้องเก็บเงิน . . เชิญ ${name} ค่ะ`,
    [],
  );

  const { calling, needsUnlock } = useAnnouncer({
    enabled: sound,
    refreshSeconds,
    buildAnnouncement,
  });

  return (
    <main className="display-screen">
      <div className="display-hosp">{hospitalName}</div>

      {calling ? (
        <>
          <div className="display-card">
            {calling.queueNo && (
              <div className="display-queue">คิว {calling.queueNo}</div>
            )}
            <div className="display-lead">เชิญ</div>
            <div className="display-name">{calling.name}</div>
            <div className="display-meta">
              <span>{calling.dept}</span>
            </div>
          </div>
          <div className="display-where">ชำระเงินที่ ห้องเก็บเงิน</div>
        </>
      ) : (
        <div className="display-idle">
          <Icon name="cashier" /> ห้องเก็บเงิน — ไม่มีคิวรอชำระ
        </div>
      )}
      {needsUnlock && (
        <div className="tv-unlock">
          <Icon name="sound" /> แตะหน้าจอหนึ่งครั้งเพื่อเปิดเสียงเรียกคิว
        </div>
      )}
    </main>
  );
}
