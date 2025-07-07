export interface Contact {
  Email: string;
  FirstName?: string;
  LastName?: string;
  Company?: string;
  Subject?: string;
  [key: string]: any;
}

export interface EmailLog {
  id: string;
  email: string;
  status: "Sent" | "Failed" | "Error";
  message?: string;
  timestamp: string;
  messageId?: string;
  firstName?: string;
  company?: string;
  subject?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailJob {
  contacts: Contact[];
  htmlContent: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  config: EmailConfig;
  delay: number;
}

export interface SMTPDefaults {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromEmail?: string;
  fromName?: string;
}


// Add these new interfaces to existing types.ts:

export interface ScheduledJob {
  id: string;
  emailJob: EmailJob;
  batchConfig?: BatchConfig;
  scheduledTime: string;
  notifyEmail?: string;
  notifyBrowser?: boolean;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  contactCount: number;
  subject: string;
  useBatch: boolean;
}

export interface NotificationSettings {
  email?: string;
  browser?: boolean;
}

export interface ProviderLimits {
  dailyLimit: number;
  name: string;
  recommendedBatchSize: number;
  recommendedDelay: number;
}