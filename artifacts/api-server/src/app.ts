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
app.use(cors());

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
