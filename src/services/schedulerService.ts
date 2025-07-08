import Database from 'bun:sqlite';
import { batchService } from './batchService';
import { emailService } from './emailService';
import { notificationService } from './notificationService';
import type { EmailJob, BatchConfig, ScheduledJob } from '../types';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

class SchedulerService {
  private db: Database;
  private schedulerInterval: Timer | null = null;
  
  constructor() {
    // Ensure data directory exists
    const dbPath = './data/scheduler.db';
    const dbDir = dirname(dbPath);
    
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
      console.log('📁 Created data directory for SQLite database');
    }
    
    this.db = new Database(dbPath);
    this.initDatabase();
    this.startScheduler();
  }
  
  private initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        email_job TEXT NOT NULL,
        batch_config TEXT,
        scheduled_time TEXT NOT NULL,
        notify_email TEXT,
        notify_browser INTEGER DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        completed_at TEXT,
        contact_count INTEGER,
        subject TEXT,
        use_batch INTEGER DEFAULT 0
      )
    `);
    
    console.log('✅ SQLite database initialized');
  }
  
  async scheduleJob(
    emailJob: EmailJob,
    batchConfig: BatchConfig | null,
    scheduledTime: Date,
    notifyEmail?: string,
    notifyBrowser?: boolean
  ): Promise<string> {
    const jobId = `sched_${Date.now()}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_jobs 
      (id, email_job, batch_config, scheduled_time, notify_email, notify_browser, contact_count, subject, use_batch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      jobId,
      JSON.stringify(emailJob),
      batchConfig ? JSON.stringify(batchConfig) : null,
      scheduledTime.toISOString(),
      notifyEmail || null,
      notifyBrowser ? 1 : 0,
      emailJob.contacts.length,
      emailJob.subject,
      batchConfig ? 1 : 0
    );
    
    console.log(`📅 Job scheduled: ${jobId} for ${scheduledTime.toLocaleString()}`);
    return jobId;
  }
  
  private startScheduler() {
    // Check every minute for due jobs
    this.schedulerInterval = setInterval(() => {
      this.checkDueJobs();
    }, 60000);
    
    console.log('⏰ Scheduler started - checking every minute for due jobs');
  }
  
  private async checkDueJobs() {
    const now = new Date().toISOString();
    
    const dueJobs = this.db.prepare(`
      SELECT * FROM scheduled_jobs 
      WHERE scheduled_time <= ? AND status = 'scheduled'
      ORDER BY scheduled_time ASC
    `).all(now);
    
    for (const job of dueJobs) {
      await this.executeScheduledJob(job);
    }
  }
  
  private async executeScheduledJob(job: any) {
    console.log(`🚀 Executing scheduled job: ${job.id}`);
    
    try {
      // Update status to running
      this.db.prepare(`
        UPDATE scheduled_jobs 
        SET status = 'running', started_at = ? 
        WHERE id = ?
      `).run(new Date().toISOString(), job.id);
      
      const emailJob: EmailJob = JSON.parse(job.email_job);
      const batchConfig: BatchConfig | null = job.batch_config ? JSON.parse(job.batch_config) : null;
      
      // Configure email service
      emailService.createTransport(emailJob.config);
      
      let executionPromise: Promise<any>;
      
      if (job.use_batch && batchConfig) {
        // Execute with batch processing
        console.log(`📦 Starting scheduled batch job: ${emailJob.contacts.length} contacts in batches`);
        executionPromise = batchService.startBatchJob(emailJob, batchConfig);
      } else {
        // Execute normal bulk sending
        console.log(`📧 Starting scheduled bulk job: ${emailJob.contacts.length} contacts`);
        executionPromise = emailService.sendBulkEmails(emailJob);
      }
      
      // Wait for completion (or start monitoring for batch jobs)
      if (job.use_batch) {
        // For batch jobs, monitor completion separately
        this.monitorBatchJobCompletion(job.id, job.notify_email, job.notify_browser);
      } else {
        // For normal jobs, wait for completion
        await executionPromise;
        await this.completeScheduledJob(job.id, job.notify_email, job.notify_browser);
      }
      
    } catch (error) {
      console.error(`❌ Scheduled job ${job.id} failed:`, error);
      
      this.db.prepare(`
        UPDATE scheduled_jobs 
        SET status = 'failed' 
        WHERE id = ?
      `).run(job.id);
    }
  }
  
  private async monitorBatchJobCompletion(jobId: string, notifyEmail?: string, notifyBrowser?: boolean) {
    // Poll batch service until job is complete
    const checkCompletion = async () => {
      const batchStatus = batchService.getBatchStatus();
      
      if (!batchStatus.isRunning) {
        // Batch job completed
        await this.completeScheduledJob(jobId, notifyEmail, notifyBrowser);
        return;
      }
      
      // Check again in 30 seconds
      setTimeout(checkCompletion, 30000);
    };
    
    // Start monitoring
    setTimeout(checkCompletion, 30000);
  }
  
  private async completeScheduledJob(jobId: string, notifyEmail?: string, notifyBrowser?: boolean) {
    const completedAt = new Date().toISOString();
    
    // Update job status
    this.db.prepare(`
      UPDATE scheduled_jobs 
      SET status = 'completed', completed_at = ? 
      WHERE id = ?
    `).run(completedAt, jobId);
    
    // Get job details and stats
    const job = this.db.prepare(`SELECT * FROM scheduled_jobs WHERE id = ?`).get(jobId);
    const stats = this.getJobStats(jobId);
    
    console.log(`✅ Scheduled job ${jobId} completed: ${stats.sent}/${stats.total} sent`);
    
    // Send notifications
    if (notifyEmail) {
      await this.sendCompletionNotification(jobId, stats, notifyEmail, job);
    }
    
    // Browser notification will be handled by frontend polling
  }
  
  private getJobStats(jobId: string) {
    // This would integrate with your log service to get actual stats
    // For now, return placeholder stats
    return {
      sent: 0,
      failed: 0,
      total: 0,
      errors: 0
    };
  }
  
  private async sendCompletionNotification(
    jobId: string,
    stats: any,
    notifyEmail: string,
    job: any
  ) {
    try {
      const jobDetails = {
        id: jobId,
        subject: job.subject || 'Bulk Email Campaign',
        startTime: job.started_at,
        endTime: job.completed_at
      };
      
      await notificationService.sendJobCompletionEmail(notifyEmail, stats, jobDetails);
    } catch (error) {
      console.error('❌ Failed to send completion notification:', error);
    }
  }
  
  getScheduledJobs(): any[] {
    return this.db.prepare(`
      SELECT id, scheduled_time, status, contact_count, subject, use_batch, notify_email
      FROM scheduled_jobs 
      WHERE status IN ('scheduled', 'running')
      ORDER BY scheduled_time ASC
    `).all();
  }
  
  async cancelScheduledJob(jobId: string): Promise<boolean> {
    try {
      const result = this.db.prepare(`
        UPDATE scheduled_jobs 
        SET status = 'cancelled' 
        WHERE id = ? AND status = 'scheduled'
      `).run(jobId);
      
      return result.changes > 0;
    } catch (error) {
      console.error('❌ Failed to cancel scheduled job:', error);
      return false;
    }
  }
  
  getJobHistory(limit: number = 50): any[] {
    return this.db.prepare(`
      SELECT * FROM scheduled_jobs 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
  }
}

export const schedulerService = new SchedulerService();