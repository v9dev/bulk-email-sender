import nodemailer from 'nodemailer';
import type { EmailLog } from '../types';

export interface NotificationConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  
  setupNotificationSender(config: NotificationConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }
  
  async sendJobCompletionEmail(
    notifyEmail: string,
    jobStats: { sent: number; failed: number; total: number; errors: number },
    jobDetails: { id: string; subject: string; startTime: string; endTime: string }
  ): Promise<boolean> {
    if (!this.transporter) {
      console.log('⚠️ Notification service not configured');
      return false;
    }
    
    try {
      const duration = this.calculateDuration(jobDetails.startTime, jobDetails.endTime);
      
      const mailOptions = {
        from: `📧 Bulk Email Sender <${process.env.NOTIFICATION_SMTP_USER}>`,
        to: notifyEmail,
        subject: `✅ Email Campaign Complete: ${jobStats.sent}/${jobStats.total} sent successfully`,
        html: this.createNotificationHTML(jobStats, jobDetails, duration)
      };
      
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Completion notification sent to ${notifyEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      return false;
    }
  }
  
  private createNotificationHTML(
    stats: { sent: number; failed: number; total: number; errors: number },
    details: { id: string; subject: string; startTime: string; endTime: string },
    duration: string
  ): string {
    const successRate = ((stats.sent / stats.total) * 100).toFixed(1);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1>📧 Email Campaign Completed!</h1>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>📊 Campaign Results</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #e8f5e8;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>✅ Successfully Sent</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #4CAF50; font-weight: bold;">${stats.sent}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>❌ Failed</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #f44336;">${stats.failed}</td>
            </tr>
            <tr style="background: #e8f5e8;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>📊 Total Contacts</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${stats.total}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>📈 Success Rate</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #4CAF50; font-weight: bold;">${successRate}%</td>
            </tr>
          </table>
          
          <h3>📋 Campaign Details</h3>
          <p><strong>Job ID:</strong> ${details.id}</p>
          <p><strong>Subject:</strong> ${details.subject}</p>
          <p><strong>Duration:</strong> ${duration}</p>
          <p><strong>Completed:</strong> ${new Date(details.endTime).toLocaleString()}</p>
          
          <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196F3;">
            <p><strong>💡 What's Next?</strong></p>
            <p>• View detailed logs in your bulk email sender dashboard</p>
            <p>• Download reports as CSV or JSON</p>
            <p>• Schedule your next campaign</p>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center;">
          <p>Sent by Bulk Email Sender | <small>Job completed at ${new Date().toLocaleString()}</small></p>
        </div>
      </div>
    `;
  }
  
  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  sendBrowserNotification(message: string): boolean {
    // This will be called from frontend
    return true;
  }
}

export const notificationService = new NotificationService();