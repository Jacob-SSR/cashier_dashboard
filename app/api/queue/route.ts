// app/api/queue/route.ts
// คิวห้องการเงินสำหรับ "จอคิว" — ไม่มี VN/HN และนามสกุลถูกปิดบังตั้งแต่ฝั่ง server
// (จอตั้งในที่สาธารณะให้คนไข้ดู จึงไม่ส่งข้อมูลระบุตัวตนลงไปที่เบราว์เซอร์เลย)
import { NextResponse } from "next/server";
import { getBoardQueue } from "@/lib/cashier.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getBoardQueue();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/queue] query failed:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
