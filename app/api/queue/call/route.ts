// app/api/queue/call/route.ts
// คนที่ถึงคิวตอนนี้ — จอใช้ประกาศเรียกชื่ออัตโนมัติ (TTS)
// ใช้ชื่อเต็มเพราะต้องอ่านออกเสียง แต่ยังไม่ส่ง VN/HN ออกไป
import { NextResponse } from "next/server";
import { getCallQueue } from "@/lib/cashier.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCallQueue();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/queue/call] query failed:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
