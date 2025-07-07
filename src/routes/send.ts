import { Hono } from "hono";
import { emailService } from "../services/emailService";
import { batchService } from "../services/batchService";
import { FileService } from "../services/fileService";
import type { EmailJob, EmailConfig, BatchConfig } from "../types";

const app = new Hono();

app.post("/send", async (c) => {
  try {
    console.log("Received POST /send request");
    const formData = await c.req.formData();

    // Log all form data for debugging
    console.log("Form data entries:");
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}: File - ${value.name} (${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    // Extract form data with environment variable fallbacks
    const smtpHost =
      (formData.get("smtpHost") as string) || process.env.SMTP_HOST || "";
    const smtpPort = parseInt(
      (formData.get("smtpPort") as string) || process.env.SMTP_PORT || "587"
    );
    // Handle checkbox value properly - 'on' means true, anything else is false
    const smtpSecureValue = formData.get("smtpSecure") as string;
    const smtpSecure =
      smtpSecureValue === "on" ||
      smtpSecureValue === "true" ||
      process.env.SMTP_SECURE === "true";
    const smtpUser =
      (formData.get("smtpUser") as string) || process.env.SMTP_USER || "";
    const smtpPass =
      (formData.get("smtpPass") as string) || process.env.SMTP_PASS || "";
    const fromEmail =
      (formData.get("fromEmail") as string) || process.env.FROM_EMAIL || "";
    const fromName =
      (formData.get("fromName") as string) || process.env.FROM_NAME || "";
    const subject = (formData.get("subject") as string) || "";
    const htmlContent = (formData.get("htmlContent") as string) || "";
    const delay = parseInt(formData.get("delay") as string) || 20;

    // Add batch processing parameters
    const useBatch = formData.get("useBatch") === "on";
    const batchSize = parseInt(formData.get("batchSize") as string) || 20;
    const batchDelay = parseInt(formData.get("batchDelay") as string) || 60;
    const emailDelay = parseInt(formData.get("emailDelay") as string) || 45;

    const excelFile = formData.get("excelFile") as File;
    const htmlTemplateFile = formData.get("htmlTemplate") as File;

    console.log("Extracted data:", {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser: smtpUser ? "***" : "empty",
      smtpPass: smtpPass ? "***" : "empty",
      fromEmail,
      fromName,
      subject: subject ? `"${subject}"` : "empty",
      htmlContent: htmlContent ? `${htmlContent.length} chars` : "empty",
      excelFile: excelFile
        ? `${excelFile.name} (${excelFile.size} bytes)`
        : "none",
      delay,
      useBatch,
      batchSize,
      batchDelay,
      emailDelay,
    });

    // Validate required fields with better error messages
    const missingFields = [];
    if (!smtpHost) missingFields.push("SMTP Host");
    if (!smtpUser) missingFields.push("SMTP User");
    if (!smtpPass) missingFields.push("SMTP Password");
    if (!fromEmail) missingFields.push("From Email");
    if (!subject || subject.trim() === "") missingFields.push("Subject");

    if (missingFields.length > 0) {
      const message = `Missing required fields: ${missingFields.join(
        ", "
      )}. Please check your settings or .env file.`;
      console.log("Validation failed:", message);
      return c.json({ success: false, message }, 400);
    }

    if (!excelFile || excelFile.size === 0) {
      const message = "Excel file is required";
      console.log("Validation failed:", message);
      return c.json({ success: false, message }, 400);
    }

    if (
      !htmlContent ||
      htmlContent.trim() === "" ||
      htmlContent === "<p><br></p>"
    ) {
      const message = "Email content is required";
      console.log("Validation failed:", message);
      return c.json({ success: false, message }, 400);
    }

    // Configure email service
    const emailConfig: EmailConfig = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };

    // Test SMTP connection
    console.log(
      `Testing SMTP connection to ${smtpHost}:${smtpPort} (secure: ${smtpSecure})...`
    );
    const connectionValid = await emailService.testConnection(emailConfig);
    if (!connectionValid) {
      return c.json(
        {
          success: false,
          message: "SMTP connection failed. Please check your settings.",
        },
        400
      );
    }

    emailService.createTransport(emailConfig);

    // Process Excel file
    let contacts = [];
    try {
      console.log("Processing Excel file...");
      const arrayBuffer = await excelFile.arrayBuffer();
      const filename = `${Date.now()}_${excelFile.name}`;
      const filePath = await FileService.saveUploadedFile(
        new Uint8Array(arrayBuffer),
        filename
      );
      contacts = await FileService.parseExcelFile(filePath);
      console.log(`Parsed ${contacts.length} contacts from Excel file`);
    } catch (error) {
      console.error("Excel parsing error:", error);
      return c.json(
        {
          success: false,
          message: `Failed to parse Excel file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        400
      );
    }

    if (contacts.length === 0) {
      return c.json(
        {
          success: false,
          message:
            "No valid contacts found in Excel file. Please ensure it has an Email column with valid email addresses.",
        },
        400
      );
    }

    // Handle HTML template file if provided
    let finalHtmlContent = htmlContent;
    if (htmlTemplateFile && htmlTemplateFile.size > 0) {
      try {
        console.log("Processing HTML template file...");
        const arrayBuffer = await htmlTemplateFile.arrayBuffer();
        const filename = `${Date.now()}_${htmlTemplateFile.name}`;
        const filePath = await FileService.saveUploadedFile(
          new Uint8Array(arrayBuffer),
          filename
        );
        finalHtmlContent = await FileService.readHTMLTemplate(filePath);
      } catch (error) {
        console.error("HTML template processing error:", error);
        return c.json(
          {
            success: false,
            message: `Failed to process HTML template: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
          400
        );
      }
    }

    // Create email job
    const emailJob: EmailJob = {
      contacts,
      htmlContent: finalHtmlContent,
      subject: subject.trim(),
      fromEmail,
      fromName,
      config: emailConfig,
      delay: useBatch ? emailDelay : delay,
    };

    // Handle batch vs normal sending
    if (useBatch) {
      const batchConfig: BatchConfig = {
        batchSize,
        emailDelay,
        batchDelay,
        enabled: true,
      };

      console.log(
        `Starting BATCH email job: ${contacts.length} contacts in batches of ${batchSize}`
      );
      const jobId = await batchService.startBatchJob(emailJob, batchConfig);

      return c.json({
        success: true,
        message: `Batch email job started! Will send ${batchSize} emails every ${batchDelay} minutes.`,
        contactCount: contacts.length,
        jobId,
        batchMode: true,
        batchConfig,
      });
    } else {
      // Original bulk sending
      console.log(
        `Starting bulk email job for ${contacts.length} contacts with ${delay}s delay...`
      );
      console.log(`Subject: "${subject.trim()}"`);
      console.log(
        `Using ${
          process.env.SMTP_HOST ? "environment" : "manual"
        } SMTP configuration`
      );

      emailService.sendBulkEmails(emailJob).catch((error) => {
        console.error("Bulk email sending failed:", error);
      });

      return c.json({
        success: true,
        message: `Email sending started for ${contacts.length} contacts`,
        contactCount: contacts.length,
        usingEnvConfig: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      });
    }
  } catch (error) {
    console.error("Send endpoint error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return c.json({ success: false, message }, 500);
  }
});

// New endpoint to parse Excel file and return contacts for preview
app.post("/parse-excel", async (c) => {
  try {
    console.log("Received POST /parse-excel request");
    const formData = await c.req.formData();
    const excelFile = formData.get("excelFile") as File;

    if (!excelFile || excelFile.size === 0) {
      return c.json({ success: false, message: "Excel file is required" }, 400);
    }

    console.log(
      `Parsing Excel file: ${excelFile.name} (${excelFile.size} bytes)`
    );

    const arrayBuffer = await excelFile.arrayBuffer();
    const filename = `temp_${Date.now()}_${excelFile.name}`;
    const filePath = await FileService.saveUploadedFile(
      new Uint8Array(arrayBuffer),
      filename
    );
    const contacts = await FileService.parseExcelFile(filePath);

    console.log(`Successfully parsed ${contacts.length} contacts`);

    // Return first few contacts for preview
    const previewContacts = contacts.slice(0, 5);

    return c.json({
      success: true,
      contacts: previewContacts,
      totalCount: contacts.length,
    });
  } catch (error) {
    console.error("Excel parsing error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to parse Excel file";
    return c.json({ success: false, message }, 500);
  }
});

// Batch control endpoints
app.get("/batch-status", (c) => {
  const status = batchService.getBatchStatus();
  return c.json({ success: true, data: status });
});

app.post("/batch-pause", async (c) => {
  await batchService.pauseCurrentJob();
  return c.json({ success: true, message: "Batch job paused" });
});

app.post("/batch-resume", async (c) => {
  await batchService.resumeCurrentJob();
  return c.json({ success: true, message: "Batch job resumed" });
});

app.delete("/batch-cancel", async (c) => {
  await batchService.cancelCurrentJob();
  return c.json({ success: true, message: "Batch job cancelled" });
});

export default app;
