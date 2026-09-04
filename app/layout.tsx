import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

// ฟอนต์ไทยเดียวกับต้นแบบ — next/font โหลดตอน build แล้ว self-host
// (เครื่องที่ build ต้องต่อเน็ตได้ ดู README หัวข้อ Docker)
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ห้องเก็บเงินโรงพยาบาลพลับพลาชัย",
  description: "ระบบจัดการคิวชำระเงิน — เชื่อมต่อ HOSxP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body>{children}</body>
    </html>
  );
}
