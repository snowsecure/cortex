/**
 * Structured logging module for CORTEX backend.
 * Uses pino for JSON-structured logs in production and pretty-printed logs in development.
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {
        // Production: JSON logs (machine-parseable)
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty-printed logs
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});

/**
 * Create a child logger with additional context fields.
 * @param {Object} bindings - e.g. { requestId, sessionId, packetId }
 */
export function childLogger(bindings) {
  return logger.child(bindings);
}

/**
 * Express middleware that attaches a request ID and a child logger to `req.log`.
 */
let requestCounter = 0;
export function requestLogger(req, res, next) {
  const requestId = req.headers["x-request-id"] || `req-${Date.now()}-${++requestCounter}`;
  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level]({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
    }, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}

export default logger;
