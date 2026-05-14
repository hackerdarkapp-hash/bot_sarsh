import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot/index.js";

const rawPort = process.env["PORT"] ?? "10000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  startBot().catch((err) => {
    logger.error({ err }, "Bot failed to start");
    process.exit(1);
  });
  startKeepAlive();
});

// ── Keep-Alive: يمنع Render من إدخال الخدمة في وضع السكون ──────────────────
function startKeepAlive() {
  const url = process.env["RENDER_EXTERNAL_URL"];
  if (!url) {
    logger.info("Keep-alive disabled (no RENDER_EXTERNAL_URL)");
    return;
  }
  const INTERVAL_MS = 14 * 60 * 1000; // كل 14 دقيقة
  setInterval(async () => {
    try {
      const res = await fetch(`${url}/api/healthz`);
      logger.info({ status: res.status }, "Keep-alive ping sent");
    } catch (err) {
      logger.warn({ err }, "Keep-alive ping failed");
    }
  }, INTERVAL_MS);
  logger.info({ url, intervalMin: 14 }, "Keep-alive started");
}

