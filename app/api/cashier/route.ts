// app/api/cashier/route.ts
// คิวห้องเก็บเงินของวันนี้ (หรือวันที่ระบุด้วย ?date=YYYY-MM-DD)
import { NextResponse, type NextRequest } from "next/server";
import { getCashierQueue } from "@/lib/cashier.service";

// หน้าจอ refresh ตลอด — ห้าม cache ที่ชั้น Next
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;

  if (date && !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const data = await getCashierQueue(date);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // อย่าส่งรายละเอียด DB ออกไปหน้าบ้าน — log ไว้ฝั่ง server พอ
    console.error("[api/cashier] query failed:", err);
    return NextResponse.json(
      { error: "ดึงข้อมูลจากฐานข้อมูลไม่สำเร็จ" },
      { status: 502 },
    );
  }
}
