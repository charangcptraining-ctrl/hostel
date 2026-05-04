import { Resident, AlertChannel, SubscriptionTier, PLAN_ALERTS, getTierValue } from '../types';
import { db } from './mockData';
import { formatCurrency } from '../constants';

export const alertService = {
  getAvailableChannels: (plan: SubscriptionTier): AlertChannel[] => {
    return PLAN_ALERTS[plan] || ['APP'];
  },

  getAlertFormats: (resident: Resident, propertyName: string) => {
    const amount = formatCurrency(resident.rent);
    const date = `${resident.dueDate}th`;
    const room = resident.roomNumber;
    const name = resident.name.split(' ')[0];

    return {
      APP: {
        title: 'Rent Due Reminder',
        body: `Hi ${name}, your rent of ${amount} for Room ${room} is due on ${date}. Please pay soon!`
      },
      EMAIL: {
        subject: `Rent Due Reminder - ${propertyName}`,
        body: `Dear ${resident.name},\n\nThis is a friendly reminder that your rent of ${amount} for Room ${room} is due on ${date}.\n\nPlease ensure payment is made on time to avoid any late fees.\n\nThank you,\n${propertyName} Management`
      },
      SMS: {
        body: `Rent Reminder: Hi ${name}, rent of ${amount} for RM ${room} is due on ${date}. - ${propertyName}`
      },
      WHATSAPP: {
        body: `Hello ${name}! 🏠 Your rent for Room ${room} is due on ${date}. Amount: ${amount}. You can pay via the app. Thank you! - ${propertyName}`
      }
    };
  },

  sendAlert: async (resident: Resident, channel: AlertChannel, propertyName: string) => {
    const formats = alertService.getAlertFormats(resident, propertyName);
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    console.log(`[ALERT] Sending ${channel} alert to ${resident.name} (${resident.phone}/${resident.email})`);
    console.log(`[ALERT CONTENT]`, formats[channel]);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Update resident's last alert month
    await db.updateResident({
      ...resident,
      lastAlertMonth: currentMonth
    });

    return true;
  },

  sendBulkAlerts: async (residents: Resident[], properties: any[], plan: SubscriptionTier, channel?: AlertChannel) => {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const availableChannels = alertService.getAvailableChannels(plan);
    const channelToUse = channel || (availableChannels.includes('EMAIL') ? 'EMAIL' : 'APP');
    
    const alertsSent: string[] = [];

    for (const resident of residents) {
      // Skip if already alerted this month
      if (resident.lastAlertMonth === currentMonth) continue;

      const property = properties.find(p => p.id === resident.propertyId || p._id === resident.propertyId);
      const propertyName = property?.name || 'Your Hostel';
      
      await alertService.sendAlert(resident, channelToUse, propertyName);
      alertsSent.push(resident.name);
    }

    return alertsSent;
  },

  checkAndSendAutomaticAlerts: async (residents: Resident[], properties: any[], plan: SubscriptionTier) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.toISOString().substring(0, 7);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const availableChannels = alertService.getAvailableChannels(plan);
    
    // Billing Automation logic
    const currentTierValue = getTierValue(plan);
    const hasAutomation = plan !== SubscriptionTier.TRIAL && currentTierValue >= 2; // PRO and above
    
    if (!hasAutomation) {
      return [];
    }

    const alertsSent: string[] = [];

    for (const resident of residents) {
      // Skip if already alerted this month
      if (resident.lastAlertMonth === currentMonth) continue;

      let diff = resident.dueDate - currentDay;
      if (diff < 0) {
        diff = (daysInMonth - currentDay) + resident.dueDate;
      }

      // Automatically send alert if within 3 days
      if (diff >= 0 && diff <= 3) {
        const property = properties.find(p => p.id === resident.propertyId || p._id === resident.propertyId);
        const propertyName = property?.name || 'Your Hostel';
        
        // Auto-send via the "best" available channel (usually APP or EMAIL)
        const channelToUse = availableChannels.includes('EMAIL') ? 'EMAIL' : 'APP';
        
        await alertService.sendAlert(resident, channelToUse, propertyName);
        alertsSent.push(resident.name);
      }
    }

    return alertsSent;
  },

  notifyStaffAboutComplaints: async (propertyName: string, count: number) => {
    console.log(`[STAFF ALERT] Sending APP-only notification to staff for ${propertyName}: ${count} active complaints.`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    return true;
  },

  broadcastNotification: async (title: string, body: string) => {
    console.log(`[BROADCAST] Sending notification to ALL users:`, { title, body });
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
};
