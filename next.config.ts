import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // run.sh öffnet die App über 127.0.0.1; ohne diesen Eintrag blockt der
  // Dev-Server alle _next-Requests fremder Origins (403) und React hydratisiert nie.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
