// app/api/queue/debug/route.ts
// ตัวช่วยหาสาเหตุ "ทำไมจอว่าง" — เปิดดูบนเครื่องที่ต่อ HOSxP
//   http://<ip>:4500/api/queue/debug
// บอกจำนวนคนที่เหลือในแต่ละขั้นของการกรอง จะได้รู้ว่าหายตรงไหน
import { NextResponse } from "next/server";
import { getQueueDebug } from "@/lib/cashier.service";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่าเชื่อมต่อ HOSxP (โหมดสาธิต)" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getQueueDebug(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/queue/debug] failed:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
