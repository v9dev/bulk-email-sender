import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { stringify } from "csv-stringify/sync";
import type { EmailLog } from "../types";

class LogService {
  private logs: EmailLog[] = [];
  private logFilePath = "./logs/email-logs.json";

  constructor() {
    this.initializeLogsDirectory();
    this.loadLogs();
  }

  private async initializeLogsDirectory() {
    if (!existsSync("./logs")) {
      await mkdir("./logs", { recursive: true });
    }
  }

  private async loadLogs() {
    try {
      if (existsSync(this.logFilePath)) {
        const data = await readFile(this.logFilePath, "utf-8");
        this.logs = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading logs:", error);
    }
  }

  private async saveLogs() {
    try {
      await writeFile(this.logFilePath, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      console.error("Error saving logs:", error);
    }
  }

  addLog(log: EmailLog) {
    this.logs.push(log);
    this.saveLogs();
  }

  getLogs(): EmailLog[] {
    return this.logs;
  }

  getLogsAsCSV(): string {
    return stringify(this.logs, {
      header: true,
      columns: [
        "id",
        "email",
        "status",
        "message",
        "timestamp",
        "messageId",
        "firstName",
        "company",
        "subject",
      ],
    });
  }

  getLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs() {
    this.logs = [];
    this.saveLogs();
  }

  getStats() {
    const total = this.logs.length;
    const sent = this.logs.filter((log) => log.status === "Sent").length;
    const failed = this.logs.filter((log) => log.status === "Failed").length;
    const errors = this.logs.filter((log) => log.status === "Error").length;

    return { total, sent, failed, errors };
  }
}

export const logService = new LogService();
