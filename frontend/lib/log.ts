import "server-only";

import pino from "pino";

/**
 * Server-only structured logger: JSON in production and human-readable output in development.
 * `LOG_LEVEL` overrides the default level.
 */
const isProduction = process.env.NODE_ENV === "production";

export const log = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),

  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            // pid and hostname say nothing useful on a developer's machine.
            ignore: "pid,hostname",
          },
        },
      }),
});