import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Reflect exact Origin back with credentials: true.
// This is required because the frontend uses fetch({ credentials: "include" }),
// and browsers reject credentialed requests when the response has
// Access-Control-Allow-Origin: * (wildcard).
app.use(
  cors({
    origin: true,        // mirror the request's Origin header
    credentials: true,   // allow cookies / auth headers
    allowedHeaders: ["Content-Type", "X-Device-Id", "X-CSRF-Token"],
    exposedHeaders: ["X-RateLimit-Remaining", "Retry-After"],
  }),
);

// Health check endpoint — responds directly without proxying to Python.
// This must come before the proxy middleware so the deployment health check
// never depends on the Python backend being up.
app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Proxy /api/* and /auth/* to Python FastAPI backend on port 8000.
// Use root-level middleware with pathFilter so Express does NOT strip the
// path prefix — the full path reaches the Python backend intact.
const pythonProxy = createProxyMiddleware({
  target: "http://localhost:8000",
  changeOrigin: true,
  pathFilter: (path) => path.startsWith("/api") || path.startsWith("/auth"),
  on: {
    error: (err, _req, res) => {
      logger.error({ err }, "Proxy error to Python backend");
      if (!("headersSent" in res) || !(res as any).headersSent) {
        (res as any).status(502).json({ detail: "Backend unavailable. Is the Product Scanner API workflow running?" });
      }
    },
  },
});

app.use(pythonProxy);

export default app;
