import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * pino resolves its transports with dynamic requires, which bundlers cannot follow —
   * bundling it yields a runtime "unable to determine transport target" instead of a build
   * error. Marking both as external leaves them as plain Node imports on the server.
   */
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
