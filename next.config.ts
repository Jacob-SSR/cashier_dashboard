import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build เป็น standalone → image เล็ก รันด้วย `node server.js` ได้เลย
  output: "standalone",

  // ปิดวงกลม "N" มุมล่างซ้ายของ next dev — บนจอที่คนไข้ดูมันไปทับตัวเลขท้ายจอ
  // (ของจริงควรรันด้วย docker compose ซึ่งเป็น production อยู่แล้วไม่มีวงกลมนี้)
  devIndicators: false,
};

export default nextConfig;
