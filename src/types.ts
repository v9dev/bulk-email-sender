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
