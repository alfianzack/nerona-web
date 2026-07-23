// Static security headers applied to every response. The Content-Security-Policy
// is NOT here — it is generated per-request with a nonce in src/middleware.ts.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // Learn is temporarily hidden — remove these redirects to re-enable
    // (also uncomment the Learn links in Header, Footer, and Hero)
    return [
      { source: "/learn", destination: "/", permanent: false },
      { source: "/learn/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
