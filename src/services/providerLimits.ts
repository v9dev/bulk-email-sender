export interface ProviderLimits {
  dailyLimit: number;
  name: string;
  recommendedBatchSize: number;
  recommendedDelay: number;
}

export class ProviderDetection {
  static detectProvider(smtpHost: string): ProviderLimits {
    const host = smtpHost.toLowerCase();
    
    if (host.includes('gmail')) {
      return {
        dailyLimit: 100,
        name: 'Gmail',
        recommendedBatchSize: 20,
        recommendedDelay: 45
      };
    }
    
    if (host.includes('outlook') || host.includes('hotmail') || host.includes('live')) {
      return {
        dailyLimit: 300,
        name: 'Outlook/Hotmail',
        recommendedBatchSize: 50,
        recommendedDelay: 30
      };
    }
    
    if (host.includes('yahoo')) {
      return {
        dailyLimit: 100,
        name: 'Yahoo',
        recommendedBatchSize: 20,
        recommendedDelay: 45
      };
    }
    
    // Custom/Enterprise SMTP
    return {
      dailyLimit: 10000, // Very high limit for custom servers
      name: 'Custom SMTP',
      recommendedBatchSize: 100,
      recommendedDelay: 15
    };
  }
  
  static calculateMaxContacts(smtpHost: string, hasNotification: boolean): number {
    const limits = this.detectProvider(smtpHost);
    
    // For Gmail/Yahoo, reserve 1 email for notification
    if (hasNotification && (limits.name === 'Gmail' || limits.name === 'Yahoo')) {
      return limits.dailyLimit - 1;
    }
    
    // For Outlook, reserve 1 email for notification  
    if (hasNotification && limits.name === 'Outlook/Hotmail') {
      return limits.dailyLimit - 1;
    }
    
    // For custom SMTP, don't limit (they usually have high limits)
    return limits.dailyLimit;
  }
}