import type { NextConfig } from "next";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.100.2"],
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};
export default nextConfig;
