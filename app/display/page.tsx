// app/display/page.tsx
// จอแสดงผลเรียกชื่อ (เปิดบนทีวี/จอที่สอง)
// dashboard จะเปิดหน้านี้พร้อม query: ?name=&hn=&vn=&dept=&hosp=
export const dynamic = "force-dynamic";

export const metadata = {
  title: "เรียกชื่อ — ห้องเก็บเงินแดง",
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const name = first(sp.name);
  const hn = first(sp.hn);
  const vn = first(sp.vn);
  const dept = first(sp.dept);
  const hosp =
    first(sp.hosp) || process.env.HOSPITAL_NAME || "โรงพยาบาลพลับพลาชัย";

  return (
    <main className="display-screen">
      <div className="display-hosp">{hosp}</div>

      {name ? (
        <>
          <div className="display-card">
            <div className="display-lead">เชิญ</div>
            <div className="display-name">{name}</div>
            <div className="display-meta">
              {hn && <span>HN {hn}</span>}
              {vn && <span>VN {vn}</span>}
              {dept && <span>{dept}</span>}
            </div>
          </div>
          <div className="display-where">ชำระเงินที่ ห้องเก็บเงินแดง</div>
        </>
      ) : (
        <div className="display-idle">
          🏦 ห้องเก็บเงินแดง — รอเรียกคิวถัดไป
        </div>
      )}
    </main>
  );
}
