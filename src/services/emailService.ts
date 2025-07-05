import nodemailer from "nodemailer";
import { logService } from "./logService";
import { FileService } from "./fileService";
import type { EmailConfig, Contact, EmailJob } from "../types";

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  createTransport(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async sendBulkEmails(job: EmailJob): Promise<void> {
    if (!this.transporter) {
      throw new Error("Email transporter not configured");
    }

    console.log(`Starting bulk email send for ${job.contacts.length} contacts`);

    for (let i = 0; i < job.contacts.length; i++) {
      const contact = job.contacts[i];

      try {
        // Replace placeholders in HTML content
        const personalizedContent = FileService.replacePlaceholders(
          job.htmlContent,
          contact
        );
        const personalizedSubject = FileService.replacePlaceholders(
          job.subject,
          contact
        );

        const mailOptions = {
          from: `${job.fromName} <${job.fromEmail}>`,
          to: contact.Email,
          subject: personalizedSubject,
          html: personalizedContent,
        };

        const info = await this.transporter.sendMail(mailOptions);

        logService.addLog({
          id: `email_${Date.now()}_${i}`,
          email: contact.Email,
          status: "Sent",
          timestamp: new Date().toISOString(),
          messageId: info.messageId,
          firstName: contact.FirstName,
          company: contact.Company,
          subject: personalizedSubject,
        });

        console.log(`Email sent to ${contact.Email}: ${info.messageId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        logService.addLog({
          id: `email_${Date.now()}_${i}`,
          email: contact.Email,
          status: "Failed",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          firstName: contact.FirstName,
          company: contact.Company,
          subject: job.subject,
        });

        console.error(
          `Failed to send email to ${contact.Email}:`,
          errorMessage
        );
      }

      // Add delay between emails (15-30 seconds)
      if (i < job.contacts.length - 1) {
        const delay = job.delay * 1000; // Convert to milliseconds
        console.log(`Waiting ${delay / 1000} seconds before next email...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log("Bulk email send completed");
  }

  async testConnection(config: EmailConfig): Promise<boolean> {
    try {
      const testTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });

      await testTransporter.verify();
      return true;
    } catch (error) {
      console.error("SMTP connection test failed:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
