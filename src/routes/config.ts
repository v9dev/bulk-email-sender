import { Hono } from "hono";
import type { SMTPDefaults } from "../types";

const app = new Hono();

// Get SMTP configuration from environment variables
app.get("/config/smtp", (c) => {
  const smtpDefaults: SMTPDefaults = {
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromEmail: process.env.FROM_EMAIL || "",
    fromName: process.env.FROM_NAME || "",
  };

  return c.json({
    success: true,
    data: smtpDefaults,
    hasConfig: !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ),
  });
});

export default app;
