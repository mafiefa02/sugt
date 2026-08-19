import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  // Story covers and gallery photographs arrive from the aggregates payloads as full Supabase
  // public-bucket URLs (`<project>.supabase.co/storage/v1/object/public/…`). `SUPABASE_URL` is the
  // internal app's environment, not this app's strict `env`, so the host cannot be read here — the
  // wildcard covers every Supabase project host instead. `cacheComponents` stays unset (ADR-0014).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  experimental: {
    // TS7's native compiler doesn't expose the programmatic API Next uses for
    // type-checking (targeted for 7.1); shell out to the tsc CLI instead.
    useTypeScriptCli: true,
    // For more information about `typedEnv`, visit this:
    // https://nextjs.org/docs/app/api-reference/config/typescript#type-intellisense-for-environment-variables
    typedEnv: true,
  },
};

export default nextConfig;
