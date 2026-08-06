import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
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
