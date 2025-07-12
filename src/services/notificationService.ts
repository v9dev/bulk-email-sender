// src/services/notificationService.ts - UPDATED WITH PROFESSIONAL ICONS
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
      const userTransporter = nodemailer.createTransport({
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
   * Create notification email subject (Professional - No Emojis)
   */
  private createNotificationSubject(stats: JobStats): string {
    const status =
      stats.successRate >= 95 ? "Success" : stats.successRate >= 50 ? "Warning" : "Alert";
    return `Campaign Complete [${status}]: ${stats.sent}/${stats.total} emails sent (${stats.successRate}%)`;
  }

  /**
   * Get professional status icon SVG
   */
  private getStatusIcon(successRate: number): string {
    if (successRate >= 95) {
      // Success checkmark circle
      return `✅`;
    } else if (successRate >= 50) {
      // Warning triangle
      return `⚠️`;
    } else {
      // Error X circle
      return `❌`;
    }
  }

  /**
   * Create notification HTML content using the new professional template
   */
  private createNotificationHTML(data: NotificationTemplateData): string {
    const { stats, details, user } = data;

    const statusColor =
      stats.successRate >= 95
        ? "#4CAF50"
        : stats.successRate >= 50
        ? "#FF9800"
        : "#f44336";

    const statusIcon = this.getStatusIcon(stats.successRate);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Campaign Completion Report</title>
        </head>
        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
              'Helvetica Neue', Arial, sans-serif;
          "
        >
          <div
            style="
              max-width: 600px;
              margin: 0 auto;
              background-color: white;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              overflow: hidden;
            "
          >
            <!-- Compact Header -->
            <div
              style="
                background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd);
                color: white;
                padding: 25px 20px;
                text-align: center;
              "
            >
              <div
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 10px;
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 8px;
                "
              >
                <span
                  style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                  "
                  >${statusIcon}</span
                >
                Campaign Completed
              </div>
              <p style="margin: 0; opacity: 0.9; font-size: 14px">
                Your bulk email campaign has finished processing
              </p>
            </div>

            <!-- User Greeting -->
            <div style="padding: 20px; border-bottom: 1px solid #f0f0f0">
              <p style="margin: 0; font-size: 16px; color: #333">
                Hi <strong>${user.name}</strong>,
              </p>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 14px">
                Your email campaign "<strong>${details.subject}</strong>" has been
                completed. Here's your detailed report:
              </p>
            </div>

            <!-- Compact Statistics Grid -->
            <div style="padding: 25px 20px">
              <h2
                style="
                  margin: 0 0 18px 0;
                  color: #333;
                  font-size: 18px;
                  font-weight: 600;
                  border-bottom: 2px solid #f0f0f0;
                  padding-bottom: 8px;
                "
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;">
                  <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2-12H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"/>
                </svg>
                Campaign Results
              </h2>

              <div
                style="
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 12px;
                  margin-bottom: 20px;
                "
              >
                <!-- Success Rate Card -->
                <div
                  style="background: #f8f9fa; border-left: 3px solid ${statusColor}; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
                >
                  <div
                    style="font-size: 24px; font-weight: bold; color: ${statusColor}; margin-bottom: 4px;"
                  >
                    ${stats.successRate}%
                  </div>
                  <div
                    style="
                      color: #666;
                      font-size: 12px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    "
                  >
                    Success Rate
                  </div>
                </div>

                <!-- Total Contacts Card -->
                <div
                  style="
                    background: #f8f9fa;
                    border-left: 3px solid #2196f3;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                  "
                >
                  <div
                    style="
                      font-size: 24px;
                      font-weight: bold;
                      color: #2196f3;
                      margin-bottom: 4px;
                    "
                  >
                    ${stats.total}
                  </div>
                  <div
                    style="
                      color: #666;
                      font-size: 12px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    "
                  >
                    Total Contacts
                  </div>
                </div>

                <!-- Sent Successfully Card -->
                <div
                  style="
                    background: #f8f9fa;
                    border-left: 3px solid #4caf50;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                  "
                >
                  <div
                    style="
                      font-size: 24px;
                      font-weight: bold;
                      color: #4caf50;
                      margin-bottom: 4px;
                    "
                  >
                    ${stats.sent}
                  </div>
                  <div
                    style="
                      color: #666;
                      font-size: 12px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    "
                  >
                    Sent Successfully
                  </div>
                </div>

                <!-- Failed Card -->
                <div
                  style="
                    background: #f8f9fa;
                    border-left: 3px solid #f44336;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                  "
                >
                  <div
                    style="
                      font-size: 24px;
                      font-weight: bold;
                      color: #f44336;
                      margin-bottom: 4px;
                    "
                  >
                    ${stats.failed}
                  </div>
                  <div
                    style="
                      color: #666;
                      font-size: 12px;
                      text-transform: uppercase;
                      letter-spacing: 0.5px;
                      font-weight: 500;
                    "
                  >
                    Failed Deliveries
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div
                style="
                  background: #eee;
                  border-radius: 6px;
                  overflow: hidden;
                  margin-bottom: 20px;
                  height: 8px;
                "
              >
                <div
                  style="background: ${statusColor}; height: 100%; width: ${stats.successRate}%; transition: width 0.3s ease;"
                ></div>
              </div>

              <!-- Campaign Details -->
              <h3
                style="
                  margin: 0 0 12px 0;
                  color: #333;
                  font-size: 16px;
                  font-weight: 600;
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 6px;">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                Campaign Details
              </h3>
              <table
                style="
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                  font-size: 14px;
                "
              >
                <tr>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #666;
                      font-weight: 500;
                    "
                  >
                    📋 Campaign ID:
                  </td>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #333;
                      font-family: 'Monaco', 'Menlo', monospace;
                      font-size: 13px;
                    "
                  >
                    ${details.id}
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #666;
                      font-weight: 500;
                    "
                  >
                    📝 Subject:
                  </td>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #333;
                    "
                  >
                    ${details.subject}
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #666;
                      font-weight: 500;
                    "
                  >
                    ⚙️ Configuration:
                  </td>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #333;
                    "
                  >
                    ${details.configUsed}
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #666;
                      font-weight: 500;
                    "
                  >
                    🚀 Processing Mode:
                  </td>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #333;
                    "
                  >
                    ${details.batchMode ? "📦 Batch Processing" : "📧 Normal Sending"}
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #666;
                      font-weight: 500;
                    "
                  >
                    ⏱️ Duration:
                  </td>
                  <td
                    style="
                      padding: 8px 0;
                      border-bottom: 1px solid #f0f0f0;
                      color: #333;
                    "
                  >
                    ${details.duration}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 500">
                    ✅ Completed:
                  </td>
                  <td style="padding: 8px 0; color: #333">
                    ${new Date(details.endTime).toLocaleString()}
                  </td>
                </tr>
              </table>

              <!-- Action Items -->
              <div
                style="
                  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
                  border-radius: 8px;
                  padding: 18px;
                  margin-bottom: 18px;
                "
              >
                <h3
                  style="
                    margin: 0 0 12px 0;
                    color: #1976d2;
                    font-size: 16px;
                    font-weight: 600;
                  "
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 6px;">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z"/>
                  </svg>
                  Next Steps
                </h3>
                <ul
                  style="
                    margin: 0;
                    padding-left: 18px;
                    color: #333;
                    line-height: 1.5;
                    font-size: 14px;
                  "
                >
                  <li style="margin-bottom: 6px">
                    View detailed logs in your dashboard for individual email status
                  </li>
                  <li style="margin-bottom: 6px">
                    Download comprehensive reports in CSV or JSON format
                  </li>
                  <li style="margin-bottom: 6px">
                    Analyze failed deliveries and update your contact list
                  </li>
                  ${stats.successRate < 95 ? `
                  <li style="margin-bottom: 6px; color: #f57c00">
                    <strong
                      >Consider reviewing failed emails and checking SMTP
                      settings</strong
                    >
                  </li>
                  ` : ""}
                  <li>Schedule your next campaign or set up automated follow-ups</li>
                </ul>
              </div>

              <!-- Performance Insights -->
              ${this.getPerformanceInsights(stats)}
            </div>

            <!-- Professional Footer -->
            <div
              style="
                background: #263238;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 0 0 8px 8px;
              "
            >
              <div
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 12px;
                "
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
                  />
                </svg>
                <span style="font-size: 16px; font-weight: 500"
                  >Bulk Email Sender</span
                >
              </div>
              <p style="margin: 0 0 12px 0; font-size: 13px; opacity: 0.8">
                Report generated on ${new Date().toLocaleString()}
              </p>
              <div
                style="
                  margin-top: 12px;
                  padding-top: 12px;
                  border-top: 1px solid #37474f;
                "
              >
                <a
                  href="http://localhost:3000"
                  style="
                    color: #64b5f6;
                    text-decoration: none;
                    font-weight: 500;
                    margin-right: 20px;
                    font-size: 14px;
                  "
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style="vertical-align: middle; margin-right: 4px"
                  >
                    <path
                      d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
                    />
                  </svg>
                  View Dashboard
                </a>
                <a
                  href="http://localhost:3000#report"
                  style="
                    color: #64b5f6;
                    text-decoration: none;
                    font-weight: 500;
                    font-size: 14px;
                  "
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style="vertical-align: middle; margin-right: 4px"
                  >
                    <path
                      d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2-12H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2z"
                    />
                  </svg>
                  Detailed Reports
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get performance insights based on campaign results (with celebratory emojis)
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