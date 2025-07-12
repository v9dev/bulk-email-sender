// src/services/notificationService.ts - COMPLETE MODULAR VERSION
import nodemailer from "nodemailer";
import { userDatabase, UserSMTPConfig } from "./userDatabase";
import { logService } from "./logService";
import type { EmailLog, NotificationConfig } from "../types";

export interface JobStats {
  sent: number;
  failed: number;
  total: number;
  errors: number;
  successRate: number;
}

export interface JobDetails {
  id: string;
  subject: string;
  startTime: string;
  endTime: string;
  duration: string;
  configUsed: string;
  batchMode: boolean;
  userId: string;
}

export interface NotificationTemplateData {
  stats: JobStats;
  details: JobDetails;
  user: {
    name: string;
    email: string;
  };
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private globalConfig: NotificationConfig | null = null;

  /**
   * Setup global notification sender (optional - for admin notifications)
   */
  setupGlobalNotificationSender(config: NotificationConfig): void {
    this.globalConfig = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    console.log("📧 Global notification service configured");
  }

  /**
   * Send job completion notification using user's SMTP config
   */
  async sendJobCompletionNotification(
    userId: string,
    notifyEmail: string,
    jobStats: Omit<JobStats, "successRate">,
    jobDetails: Omit<JobDetails, "duration" | "userId">,
    configUsed: string
  ): Promise<boolean> {
    try {
      // Get user details
      const user = userDatabase.getUserById(userId);
      if (!user) {
        console.error("❌ User not found for notification");
        return false;
      }

      // Calculate additional stats
      const successRate =
        jobStats.total > 0 ? (jobStats.sent / jobStats.total) * 100 : 0;

      const duration = this.calculateDuration(
        jobDetails.startTime,
        jobDetails.endTime
      );

      const completeJobStats: JobStats = {
        ...jobStats,
        successRate: parseFloat(successRate.toFixed(1)),
      };

      const completeJobDetails: JobDetails = {
        ...jobDetails,
        duration,
        userId,
        configUsed,
      };

      // Try to use user's SMTP config first
      const userConfig = userDatabase.getUserDefaultSMTPConfig(userId);
      if (userConfig) {
        return await this.sendWithUserConfig(
          userConfig,
          notifyEmail,
          completeJobStats,
          completeJobDetails,
          user
        );
      }

      // Fallback to global config if available
      if (this.globalConfig && this.transporter) {
        return await this.sendWithGlobalConfig(
          notifyEmail,
          completeJobStats,
          completeJobDetails,
          user
        );
      }

      console.error("❌ No notification sender configured");
      return false;
    } catch (error) {
      console.error("❌ Failed to send job completion notification:", error);
      return false;
    }
  }

  /**
   * Send notification using user's SMTP configuration
   */
  private async sendWithUserConfig(
    userConfig: UserSMTPConfig,
    notifyEmail: string,
    jobStats: JobStats,
    jobDetails: JobDetails,
    user: any
  ): Promise<boolean> {
    try {
      // Create transporter with user's config
      const userTransporter = nodemailer.createTransporter({
        host: userConfig.host,
        port: userConfig.port,
        secure: !!userConfig.secure,
        auth: {
          user: userConfig.user,
          pass: userConfig.pass,
        },
      });

      const mailOptions = {
        from: `${userConfig.from_name || "Email Campaign"} <${
          userConfig.from_email
        }>`,
        to: notifyEmail,
        subject: this.createNotificationSubject(jobStats),
        html: this.createNotificationHTML({
          stats: jobStats,
          details: jobDetails,
          user,
        }),
      };

      await userTransporter.sendMail(mailOptions);
      console.log(
        `📧 User config notification sent to ${notifyEmail} using ${userConfig.name}`
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to send with user config:", error);
      return false;
    }
  }

  /**
   * Send notification using global configuration
   */
  private async sendWithGlobalConfig(
    notifyEmail: string,
    jobStats: JobStats,
    jobDetails: JobDetails,
    user: any
  ): Promise<boolean> {
    try {
      if (!this.transporter || !this.globalConfig) {
        return false;
      }

      const mailOptions = {
        from: `${this.globalConfig.fromName} <${this.globalConfig.user}>`,
        to: notifyEmail,
        subject: this.createNotificationSubject(jobStats),
        html: this.createNotificationHTML({
          stats: jobStats,
          details: jobDetails,
          user,
        }),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Global config notification sent to ${notifyEmail}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to send with global config:", error);
      return false;
    }
  }

  /**
   * Create notification email subject
   */
  private createNotificationSubject(stats: JobStats): string {
    const status =
      stats.successRate >= 95 ? "✅" : stats.successRate >= 50 ? "⚠️" : "❌";
    return `${status} Campaign Complete: ${stats.sent}/${stats.total} emails sent (${stats.successRate}%)`;
  }

  /**
   * Create notification HTML content (different from campaign emails)
   */
  private createNotificationHTML(data: NotificationTemplateData): string {
    const { stats, details, user } = data;

    const statusColor =
      stats.successRate >= 95
        ? "#4CAF50"
        : stats.successRate >= 50
        ? "#FF9800"
        : "#f44336";

    const statusIcon =
      stats.successRate >= 95 ? "✅" : stats.successRate >= 50 ? "⚠️" : "❌";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Campaign Completion Report</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd); color: white; padding: 30px 20px; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 10px;">${statusIcon}</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Campaign Completed</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Your bulk email campaign has finished processing</p>
          </div>

          <!-- User Greeting -->
          <div style="padding: 20px; border-bottom: 1px solid #eee;">
            <p style="margin: 0; font-size: 16px; color: #333;">
              Hi <strong>${user.name}</strong>,
            </p>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
              Your email campaign "<strong>${
                details.subject
              }</strong>" has been completed. Here's your detailed report:
            </p>
          </div>

          <!-- Statistics Grid -->
          <div style="padding: 30px 20px;">
            <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
              📊 Campaign Results
            </h2>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px;">
              
              <!-- Success Rate -->
              <div style="background: #f8f9fa; border-left: 4px solid ${statusColor}; padding: 20px; border-radius: 0 8px 8px 0;">
                <div style="font-size: 28px; font-weight: bold; color: ${statusColor}; margin-bottom: 5px;">
                  ${stats.successRate}%
                </div>
                <div style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Success Rate
                </div>
              </div>

              <!-- Total Emails -->
              <div style="background: #f8f9fa; border-left: 4px solid #2196F3; padding: 20px; border-radius: 0 8px 8px 0;">
                <div style="font-size: 28px; font-weight: bold; color: #2196F3; margin-bottom: 5px;">
                  ${stats.total}
                </div>
                <div style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Total Contacts
                </div>
              </div>

              <!-- Sent Successfully -->
              <div style="background: #f8f9fa; border-left: 4px solid #4CAF50; padding: 20px; border-radius: 0 8px 8px 0;">
                <div style="font-size: 28px; font-weight: bold; color: #4CAF50; margin-bottom: 5px;">
                  ${stats.sent}
                </div>
                <div style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Sent Successfully
                </div>
              </div>

              <!-- Failed -->
              <div style="background: #f8f9fa; border-left: 4px solid #f44336; padding: 20px; border-radius: 0 8px 8px 0;">
                <div style="font-size: 28px; font-weight: bold; color: #f44336; margin-bottom: 5px;">
                  ${stats.failed}
                </div>
                <div style="color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Failed Deliveries
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="background: #eee; border-radius: 10px; overflow: hidden; margin-bottom: 25px;">
              <div style="background: ${statusColor}; height: 12px; width: ${
      stats.successRate
    }%; transition: width 0.3s ease;"></div>
            </div>

            <!-- Campaign Details -->
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">📋 Campaign Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-weight: 500;">Campaign ID:</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333; font-family: monospace;">${
                  details.id
                }</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-weight: 500;">Subject:</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">${
                  details.subject
                }</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-weight: 500;">Configuration:</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">${
                  details.configUsed
                }</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-weight: 500;">Processing Mode:</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">
                  ${
                    details.batchMode
                      ? "📦 Batch Processing"
                      : "📧 Normal Sending"
                  }
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-weight: 500;">Duration:</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">${
                  details.duration
                }</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #666; font-weight: 500;">Completed:</td>
                <td style="padding: 12px 0; color: #333;">${new Date(
                  details.endTime
                ).toLocaleString()}</td>
              </tr>
            </table>

            <!-- Action Items -->
            <div style="background: linear-gradient(135deg, #e3f2fd, #f3e5f5); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #1976d2; font-size: 18px;">🎯 Next Steps</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 1.6;">
                <li style="margin-bottom: 8px;">View detailed logs in your dashboard for individual email status</li>
                <li style="margin-bottom: 8px;">Download comprehensive reports in CSV or JSON format</li>
                <li style="margin-bottom: 8px;">Analyze failed deliveries and update your contact list</li>
                ${
                  stats.successRate < 95
                    ? '<li style="margin-bottom: 8px; color: #f57c00;"><strong>Consider reviewing failed emails and checking SMTP settings</strong></li>'
                    : ""
                }
                <li>Schedule your next campaign or set up automated follow-ups</li>
              </ul>
            </div>

            <!-- Performance Insights -->
            ${this.getPerformanceInsights(stats)}

          </div>

          <!-- Footer -->
          <div style="background: #263238; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 500;">
              📧 Bulk Email Sender
            </p>
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">
              Report generated on ${new Date().toLocaleString()}
            </p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #37474f;">
              <a href="http://localhost:3000" style="color: #64b5f6; text-decoration: none; font-weight: 500;">
                📊 View Dashboard
              </a>
              <span style="margin: 0 15px; opacity: 0.5;">|</span>
              <a href="http://localhost:3000#report" style="color: #64b5f6; text-decoration: none; font-weight: 500;">
                📈 Detailed Reports
              </a>
            </div>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get performance insights based on campaign results
   */
  private getPerformanceInsights(stats: JobStats): string {
    if (stats.successRate >= 98) {
      return `
        <div style="background: #e8f5e8; border-left: 4px solid #4CAF50; padding: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 16px;">🎉 Excellent Performance!</h4>
          <p style="margin: 0; color: #2e7d32; font-size: 14px;">
            Outstanding delivery rate! Your email configuration and content are optimized perfectly.
          </p>
        </div>
      `;
    } else if (stats.successRate >= 90) {
      return `
        <div style="background: #fff3e0; border-left: 4px solid #FF9800; padding: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 10px 0; color: #ef6c00; font-size: 16px;">👍 Good Performance</h4>
          <p style="margin: 0; color: #ef6c00; font-size: 14px;">
            Solid delivery rate. Consider reviewing failed emails to improve future campaigns.
          </p>
        </div>
      `;
    } else {
      return `
        <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="margin: 0 0 10px 0; color: #c62828; font-size: 16px;">⚠️ Needs Attention</h4>
          <p style="margin: 0; color: #c62828; font-size: 14px;">
            Lower than expected delivery rate. Check SMTP settings, email content, and contact list quality.
          </p>
        </div>
      `;
    }
  }

  /**
   * Calculate duration between start and end time
   */
  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Send test notification (for testing purposes)
   */
  async sendTestNotification(
    userId: string,
    testEmail: string
  ): Promise<boolean> {
    const mockStats: JobStats = {
      sent: 85,
      failed: 15,
      total: 100,
      errors: 0,
      successRate: 85,
    };

    const mockDetails: JobDetails = {
      id: "test_campaign_123",
      subject: "Test Campaign - Welcome Email",
      startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      endTime: new Date().toISOString(),
      duration: "10m 30s",
      configUsed: "Test SMTP Configuration",
      batchMode: true,
      userId,
    };

    return await this.sendJobCompletionNotification(
      userId,
      testEmail,
      {
        sent: mockStats.sent,
        failed: mockStats.failed,
        total: mockStats.total,
        errors: mockStats.errors,
      },
      {
        id: mockDetails.id,
        subject: mockDetails.subject,
        startTime: mockDetails.startTime,
        endTime: mockDetails.endTime,
        configUsed: mockDetails.configUsed,
        batchMode: mockDetails.batchMode,
      },
      mockDetails.configUsed
    );
  }

  /**
   * Get campaign statistics from logs
   */
  getCampaignStats(jobId: string): JobStats {
    const logs = logService.getLogs();
    const campaignLogs = logs.filter((log) => log.id.includes(jobId));

    const sent = campaignLogs.filter((log) => log.status === "Sent").length;
    const failed = campaignLogs.filter((log) => log.status === "Failed").length;
    const errors = campaignLogs.filter((log) => log.status === "Error").length;
    const total = campaignLogs.length;

    const successRate = total > 0 ? (sent / total) * 100 : 0;

    return {
      sent,
      failed,
      total,
      errors,
      successRate: parseFloat(successRate.toFixed(1)),
    };
  }
}

export const notificationService = new NotificationService();

// Initialize global notification service if configured
if (process.env.NOTIFICATION_SMTP_USER) {
  const globalConfig: NotificationConfig = {
    host: process.env.NOTIFICATION_SMTP_HOST || process.env.SMTP_HOST || "",
    port: parseInt(
      process.env.NOTIFICATION_SMTP_PORT || process.env.SMTP_PORT || "587"
    ),
    secure:
      (process.env.NOTIFICATION_SMTP_SECURE || process.env.SMTP_SECURE) ===
      "true",
    user: process.env.NOTIFICATION_SMTP_USER || "",
    pass: process.env.NOTIFICATION_SMTP_PASS || "",
    fromName:
      process.env.NOTIFICATION_FROM_NAME || "Email Campaign Notifications",
  };

  notificationService.setupGlobalNotificationSender(globalConfig);
}
