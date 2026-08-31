import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // build เป็น standalone → image เล็ก รันด้วย `node server.js` ได้เลย
  output: "standalone",
};

export default nextConfig;
