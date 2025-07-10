import { Hono } from "hono";
import type { SMTPDefaults } from "../types";

// Environment config (always available)
const envConfig: SMTPDefaults = {
  host: process.env.SMTP_HOST || "",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  fromEmail: process.env.FROM_EMAIL || "",
  fromName: process.env.FROM_NAME || "",
};

// Custom config (user overrides)
let customConfig: SMTPDefaults = { ...envConfig };

// Current mode: 'env' or 'custom'
let currentMode: "env" | "custom" = "env";

const hasEnvConfig = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const app = new Hono();

// GET current config
app.get("/config/smtp", (c) => {
  const activeConfig = currentMode === "env" ? envConfig : customConfig;

  return c.json({
    success: true,
    data: activeConfig,
    hasConfig: !!(activeConfig.host && activeConfig.user && activeConfig.pass),
    hasEnvConfig,
    currentMode,
    envConfig: hasEnvConfig ? envConfig : null,
    customConfig,
  });
});

// POST - Toggle between env and custom mode
app.post("/config/smtp/mode", async (c) => {
  try {
    const body = await c.req.json();
    const newMode = body.mode;

    if (newMode === "env" && !hasEnvConfig) {
      return c.json(
        {
          success: false,
          message:
            "❌ Cannot switch to .env mode - no environment configuration found",
        },
        400
      );
    }

    if (newMode !== "env" && newMode !== "custom") {
      return c.json(
        {
          success: false,
          message: "❌ Invalid mode. Use 'env' or 'custom'",
        },
        400
      );
    }

    currentMode = newMode;
    const activeConfig = currentMode === "env" ? envConfig : customConfig;

    console.log(`🔄 SMTP mode switched to: ${currentMode}`);

    return c.json({
      success: true,
      message: `✅ Switched to ${
        currentMode === "env" ? ".env" : "custom"
      } configuration`,
      currentMode,
      data: activeConfig,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        message: "❌ Failed to switch configuration mode",
      },
      500
    );
  }
});

// POST - Update custom config (only works in custom mode)
app.post("/config/smtp", async (c) => {
  try {
    if (currentMode === "env") {
      return c.json(
        {
          success: false,
          message:
            "❌ Cannot update config in .env mode. Switch to 'Custom Settings' first.",
          currentMode: "env",
        },
        403
      );
    }

    const body = await c.req.json();

    customConfig = {
      host: body.host || customConfig.host,
      port: body.port || customConfig.port,
      secure: body.secure !== undefined ? body.secure : customConfig.secure,
      user: body.user || customConfig.user,
      pass: body.pass || customConfig.pass,
      fromEmail: body.fromEmail || customConfig.fromEmail,
      fromName: body.fromName || customConfig.fromName,
    };

    console.log("💾 Custom SMTP config updated");

    return c.json({
      success: true,
      data: customConfig,
      message: "✅ Custom SMTP configuration updated",
      currentMode: "custom",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        message: "❌ Failed to update SMTP configuration",
      },
      500
    );
  }
});

// GET active config for sending emails
app.get("/config/smtp/active", (c) => {
  const activeConfig = currentMode === "env" ? envConfig : customConfig;

  return c.json({
    success: true,
    data: activeConfig,
    mode: currentMode,
  });
});

export default app;
