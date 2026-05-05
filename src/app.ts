import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { stripeWebhookHandler } from "./routes/stripe-webhook.js";
import { logger } from "./lib/logger.js";
import { seedDatabase } from "./lib/seed.js";
import { initializePhase6Schema } from "./lib/phase6-schema.js";

const app: Express = express();
const allowedOrigins = (process.env["CORS_ORIGIN"] || process.env["FRONTEND_URL"] || "http://localhost:3000,http://localhost:5173,https://docuspsi.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

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
app.use(cors(corsOptions));
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

initializePhase6Schema()
  .then(seedDatabase)
  .catch((err) => logger.error(err, "Database startup tasks failed"));

export default app;
