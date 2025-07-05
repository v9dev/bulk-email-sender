import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { config } from "dotenv";

import indexRoutes from "./routes/index";
import sendRoutes from "./routes/send";
import reportRoutes from "./routes/report";
import configRoutes from "./routes/config";

// Load environment variables
config();

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Initialize directories
async function initializeDirectories() {
  const dirs = ["./uploads", "./logs", "./public"];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

// Routes
app.route("/", indexRoutes);
app.route("/", sendRoutes);
app.route("/", reportRoutes);
app.route("/", configRoutes);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 404 handler
app.notFound((c) => {
  return c.json({ message: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Application error:", err);
  return c.json({ message: "Internal Server Error" }, 500);
});

// Initialize and start server
const port = process.env.PORT || 3000;

console.log("Initializing application...");
await initializeDirectories();

// Display configuration status
if (process.env.SMTP_HOST) {
  console.log("✅ SMTP configuration found in environment variables");
  console.log(`   Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.FROM_EMAIL}`);
} else {
  console.log(
    "⚠️  No SMTP configuration found in .env file - will use manual configuration"
  );
}

console.log(`Server starting on port ${port}`);
console.log(`Access the application at: http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
