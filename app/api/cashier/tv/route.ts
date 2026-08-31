// app/api/cashier/tv/route.ts
// คิวสำหรับจอ TV — ไม่มี VN/HN และนามสกุลถูกปิดบังตั้งแต่ฝั่ง server
// (จอตั้งในที่สาธารณะ จึงไม่ส่งข้อมูลระบุตัวตนลงไปที่เบราว์เซอร์เลย)
import { NextResponse } from "next/server";
import { getTvQueue } from "@/lib/cashier.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTvQueue();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/cashier/tv] query failed:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
