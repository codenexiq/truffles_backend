import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { globalRateLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import { extraSecurityHeaders, noStore, originGuard, requireJson } from "./middlewares/security.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  // Never advertise the framework; trust a proxy's client-IP header only when told to
  // (otherwise anyone could fake their IP and dodge the rate limits).
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  // Security headers. This is a JSON API, so nothing on it should ever be rendered,
  // framed or scripted: the policy forbids everything.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "base-uri": ["'none'"],
          "form-action": ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" },
      hsts: env.isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
    })
  );
  app.use(extraSecurityHeaders);

  // CORS: only the website origins in CLIENT_URL (production has no localhost).
  // Requests with no Origin header (curl, server-to-server) are not browser traffic and pass through.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Order-Token"],
      maxAge: 600,
    })
  );

  // Abuse control before any parsing work is done.
  app.use(globalRateLimiter);

  // Small, JSON-only bodies. (No urlencoded/form parsing: the API has no use for it.)
  app.use(requireJson);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT, strict: true, type: "application/json" }));
  app.use(cookieParser());
  app.use(originGuard);

  // Responses may contain personal data: never cache.
  app.use(noStore);

  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.isProd ? "combined" : "dev"));
  }

  app.get("/", (_req, res) => {
    res.json({ name: "Truffles Rooftop Restaurant API", status: "ok" });
  });

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
