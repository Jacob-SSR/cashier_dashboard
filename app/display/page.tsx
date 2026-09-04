// app/display/page.tsx
// จอเรียกชื่อเต็มจอ (จอที่สอง/ทีวีอีกเครื่อง) — ขึ้นชื่อคนที่ถึงคิวทีละคน
// ต่างจากหน้าแรกตรงที่หน้าแรกโชว์คิวทั้งกระดาน หน้านี้โชว์คนเดียวตัวใหญ่เต็มจอ
import CallDisplay from "../CallDisplay";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "เรียกชื่อ — ห้องเก็บเงิน",
};

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // ?sound=0 = ปิดเสียงจอนี้ (ถ้าให้หน้าแรกเป็นตัวประกาศอยู่แล้ว)
  const sound = (Array.isArray(sp.sound) ? sp.sound[0] : sp.sound) !== "0";

  return (
    <CallDisplay
      hospitalName={process.env.HOSPITAL_NAME || "โรงพยาบาลพลับพลาชัย"}
      refreshSeconds={Number(process.env.REFRESH_SECONDS ?? 15)}
      sound={sound}
    />
  );
}
