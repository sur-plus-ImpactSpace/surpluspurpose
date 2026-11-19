/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@surplus/domain"],
  // Hide the Next.js dev indicator (the floating "N" route/bundler panel). It is
  // a local dev-only overlay and never shipped to production anyway.
  devIndicators: false,
  // Local dev is reached via both localhost and 127.0.0.1. Without allow-listing
  // 127.0.0.1, Next 16 blocks cross-origin dev resources (HMR/client chunks) and
  // the page never hydrates — every button/link looks dead. Add your LAN IP here
  // locally if you test from a phone. Dev-only; ignored in production builds.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
