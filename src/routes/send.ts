import { Hono } from "hono";
import { emailService } from "../services/emailService";
import { batchService } from "../services/batchService";
import { schedulerService } from "../services/schedulerService";
import { notificationService } from "../services/notificationService";
import { ProviderDetection } from "../services/providerLimits";
import { FileService } from "../services/fileService";
import type { EmailJob, EmailConfig, BatchConfig, NotificationConfig } from "../types";

const app = new Hono();

// Initialize notification service if configured
if (process.env.NOTIFICATION_SMTP_USER) {
  const notificationConfig: NotificationConfig = {
    host: process.env.NOTIFICATION_SMTP_HOST || process.env.SMTP_HOST || '',
    port: parseInt(process.env.NOTIFICATION_SMTP_PORT || process.env.SMTP_PORT || '587'),
    secure: (process.env.NOTIFICATION_SMTP_SECURE || process.env.SMTP_SECURE) === 'true',
    user: process.env.NOTIFICATION_SMTP_USER || '',
    pass: process.env.NOTIFICATION_SMTP_PASS || '',
    fromName: process.env.NOTIFICATION_FROM_NAME || 'Email Campaign Notifications'
  };
  
  notificationService.setupNotificationSender(notificationConfig);
  console.log('📧 Notification service configured');
}

app.post("/send", async (c) => {
  try {
    console.log("Received POST /send request");
    const formData = await c.req.formData();

    // Extract all form data
    const smtpHost = (formData.get("smtpHost") as string) || process.env.SMTP_HOST || "";
    const smtpPort = parseInt((formData.get("smtpPort") as string) || process.env.SMTP_PORT || "587");
    const smtpSecureValue = formData.get("smtpSecure") as string;
    const smtpSecure = smtpSecureValue === "on" || smtpSecureValue === "true" || process.env.SMTP_SECURE === "true";
    const smtpUser = (formData.get("smtpUser") as string) || process.env.SMTP_USER || "";
    const smtpPass = (formData.get("smtpPass") as string) || process.env.SMTP_PASS || "";
    const fromEmail = (formData.get("fromEmail") as string) || process.env.FROM_EMAIL || "";
    const fromName = (formData.get("fromName") as string) || process.env.FROM_NAME || "";
    const subject = (formData.get("subject") as string) || "";
    const htmlContent = (formData.get("htmlContent") as string) || "";
    const delay = parseInt(formData.get("delay") as string) || 20;

    // Batch processing
    const useBatch = formData.get('useBatch') === 'on';
    const batchSize = parseInt(formData.get('batchSize') as string) || 20;
    const batchDelay = parseInt(formData.get('batchDelay') as string) || 60;
    const emailDelay = parseInt(formData.get('emailDelay') as string) || 45;

    // Scheduling
    const scheduleEmail = formData.get('scheduleEmail') === 'on';
    const scheduledTime = formData.get('scheduledTime') as string;
    const notifyEmail = formData.get('notifyEmail') as string;
    const notifyBrowser = formData.get('notifyBrowser') === 'on';

    const excelFile = formData.get("excelFile") as File;
    const htmlTemplateFile = formData.get("htmlTemplate") as File;

    console.log("Extracted data:", {
      smtpHost, smtpPort, smtpSecure, useBatch, batchSize, batchDelay, emailDelay,
      scheduleEmail, scheduledTime, notifyEmail, notifyBrowser,
      subject: subject ? `"${subject}"` : "empty",
      excelFile: excelFile ? `${excelFile.name} (${excelFile.size} bytes)` : "none"
    });

    // Validate required fields
    const missingFields = [];
    if (!smtpHost) missingFields.push("SMTP Host");
    if (!smtpUser) missingFields.push("SMTP User");
    if (!smtpPass) missingFields.push("SMTP Password");
    if (!fromEmail) missingFields.push("From Email");
    if (!subject || subject.trim() === "") missingFields.push("Subject");
    if (scheduleEmail && !scheduledTime) missingFields.push("Scheduled Time");

    if (missingFields.length > 0) {
      return c.json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(", ")}` 
      }, 400);
    }

    if (!excelFile || excelFile.size === 0) {
      return c.json({ success: false, message: "Excel file is required" }, 400);
    }

    // UPDATED: Check content - HTML template OR editor content required
    if (!htmlTemplateFile || htmlTemplateFile.size === 0) {
      // Only require editor content if no HTML template
      if (!htmlContent || htmlContent.trim() === "" || htmlContent === "<p><br></p>") {
        return c.json({ 
          success: false, 
          message: "Email content is required (either in editor or upload HTML template)" 
        }, 400);
      }
    }

    // Configure email service
    const emailConfig: EmailConfig = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    };

    // Test SMTP connection
    console.log(`Testing SMTP connection to ${smtpHost}:${smtpPort}...`);
    const connectionValid = await emailService.testConnection(emailConfig);
    if (!connectionValid) {
      return c.json({
        success: false,
        message: "SMTP connection failed. Please check your settings.",
      }, 400);
    }

    // Process Excel file
    let contacts = [];
    try {
      console.log("Processing Excel file...");
      const arrayBuffer = await excelFile.arrayBuffer();
      const filename = `${Date.now()}_${excelFile.name}`;
      const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename);
      contacts = await FileService.parseExcelFile(filePath);
      console.log(`Parsed ${contacts.length} contacts from Excel file`);
    } catch (error) {
      console.error("Excel parsing error:", error);
      return c.json({
        success: false,
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
      }, 400);
    }

    // Check provider limits
    const maxContacts = ProviderDetection.calculateMaxContacts(smtpHost, !!notifyEmail);
    if (contacts.length > maxContacts) {
      const provider = ProviderDetection.detectProvider(smtpHost);
      return c.json({
        success: false,
        message: `${provider.name} limit: Maximum ${maxContacts} contacts allowed${notifyEmail ? ' (1 reserved for notification)' : ''}`
      }, 400);
    }

    // Handle HTML template file if provided
    let finalHtmlContent = htmlContent;
    if (htmlTemplateFile && htmlTemplateFile.size > 0) {
      try {
        console.log("Processing HTML template file...");
        const arrayBuffer = await htmlTemplateFile.arrayBuffer();
        const filename = `${Date.now()}_${htmlTemplateFile.name}`;
        const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename);
        finalHtmlContent = await FileService.readHTMLTemplate(filePath);
        console.log("Using HTML template as primary content");
      } catch (error) {
        return c.json({
          success: false,
          message: `Failed to process HTML template: ${error instanceof Error ? error.message : "Unknown error"}`
        }, 400);
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

    // Create batch config if needed
    const batchConfig: BatchConfig | null = useBatch ? {
      batchSize,
      emailDelay,
      batchDelay,
      enabled: true
    } : null;

    // Handle scheduling vs immediate sending
    if (scheduleEmail) {
      const scheduledDate = new Date(scheduledTime);
      
      if (scheduledDate <= new Date()) {
        return c.json({
          success: false,
          message: "Scheduled time must be in the future"
        }, 400);
      }

      // Schedule the job
      const jobId = await schedulerService.scheduleJob(
        emailJob,
        batchConfig,
        scheduledDate,
        notifyEmail,
        notifyBrowser
      );

      return c.json({
        success: true,
        message: `📅 Email campaign scheduled for ${scheduledDate.toLocaleString()}`,
        jobId,
        scheduledTime: scheduledDate.toISOString(),
        contactCount: contacts.length,
        scheduledMode: true,
        batchMode: useBatch
      });
    } else {
      // Immediate sending
      if (useBatch) {
        console.log(`Starting BATCH email job: ${contacts.length} contacts in batches of ${batchSize}`);
        const jobId = await batchService.startBatchJob(emailJob, batchConfig!);
        
        return c.json({
          success: true,
          message: `Batch email job started! Will send ${batchSize} emails every ${batchDelay} minutes.`,
          contactCount: contacts.length,
          jobId,
          batchMode: true,
          batchConfig
        });
      } else {
        // Normal bulk sending
        emailService.createTransport(emailConfig);
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
    }
  } catch (error) {
    console.error("Send endpoint error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return c.json({ success: false, message }, 500);
  }
});

// Get provider info for UI
app.post('/provider-info', async (c) => {
  try {
    const formData = await c.req.formData();
    const smtpHost = (formData.get('smtpHost') as string) || '';
    const hasNotification = (formData.get('hasNotification') as string) === 'true';
    
    if (!smtpHost) {
      return c.json({ success: false, message: 'SMTP host required' }, 400);
    }
    
    const provider = ProviderDetection.detectProvider(smtpHost);
    const maxContacts = ProviderDetection.calculateMaxContacts(smtpHost, hasNotification);
    
    return c.json({
      success: true,
      data: {
        provider: provider.name,
        dailyLimit: provider.dailyLimit,
        maxContacts,
        recommendedBatchSize: provider.recommendedBatchSize,
        recommendedDelay: provider.recommendedDelay
      }
    });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to detect provider' }, 500);
  }
});

// Scheduled jobs management
app.get('/scheduled-jobs', (c) => {
  const jobs = schedulerService.getScheduledJobs();
  return c.json({ success: true, data: jobs });
});

app.delete('/scheduled-jobs/:id', async (c) => {
  const jobId = c.req.param('id');
  const cancelled = await schedulerService.cancelScheduledJob(jobId);
  
  if (cancelled) {
    return c.json({ success: true, message: 'Scheduled job cancelled' });
  } else {
    return c.json({ success: false, message: 'Job not found or cannot be cancelled' }, 404);
  }
});

// Existing endpoints (parse-excel, batch-status, etc.)
app.post("/parse-excel", async (c) => {
  try {
    const formData = await c.req.formData();
    const excelFile = formData.get("excelFile") as File;

    if (!excelFile || excelFile.size === 0) {
      return c.json({ success: false, message: "Excel file is required" }, 400);
    }

    const arrayBuffer = await excelFile.arrayBuffer();
    const filename = `temp_${Date.now()}_${excelFile.name}`;
    const filePath = await FileService.saveUploadedFile(new Uint8Array(arrayBuffer), filename);
    const contacts = await FileService.parseExcelFile(filePath);

    const previewContacts = contacts.slice(0, 5);

    return c.json({
      success: true,
      contacts: previewContacts,
      totalCount: contacts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse Excel file";
    return c.json({ success: false, message }, 500);
  }
});

// Batch control endpoints
app.get('/batch-status', (c) => {
  const status = batchService.getBatchStatus();
  return c.json({ success: true, data: status });
});

app.post('/batch-pause', async (c) => {
  await batchService.pauseCurrentJob();
  return c.json({ success: true, message: 'Batch job paused' });
});

app.post('/batch-resume', async (c) => {
  await batchService.resumeCurrentJob();
  return c.json({ success: true, message: 'Batch job resumed' });
});

app.delete('/batch-cancel', async (c) => {
  await batchService.cancelCurrentJob();
  return c.json({ success: true, message: 'Batch job cancelled' });
});

export default app;