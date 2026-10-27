import cron from 'node-cron';
import { prisma } from '../db';
import { realtimeEmitter } from '../realtime';
import { emailService } from '../services/email';
import { calculateDriverSafetyScore } from '../services/safetyScore';
import { getIndianDateString } from '../utils/indianDate';

let scheduled = false;

function daysUntilExpiry(expiryDate: string): number {
  const expiry = Date.parse(`${expiryDate}T00:00:00Z`);
  const today = Date.parse(`${getIndianDateString()}T00:00:00Z`);
  return Math.ceil((expiry - today) / 86_400_000);
}

async function checkDriverCompliance(driver: {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  licenseExpiryDate: string;
  status: string;
  lastLicenseReminderKey: string | null;
}): Promise<void> {
  try {
    const daysLeft = daysUntilExpiry(driver.licenseExpiryDate);
    if (daysLeft < 0 && driver.status !== 'Suspended') {
      await prisma.driver.update({ where: { id: driver.id }, data: { status: 'Suspended' } });
      realtimeEmitter.driverStatus(driver.id, 'Suspended', driver.tenantId);
    }

    await calculateDriverSafetyScore(driver.tenantId, driver.id);

    if (daysLeft < 0 || daysLeft > 30) return;
    const reminderKey = `${driver.licenseExpiryDate}:${Math.floor(daysLeft / 7)}`;
    if (driver.lastLicenseReminderKey === reminderKey) return;
    if (!driver.email || driver.email.toLowerCase().endsWith('@transitops.com')) {
      console.warn(`[TransitOps Compliance] Reminder skipped for driver ${driver.id}: a real email address is required.`);
      return;
    }

    const claimed = await prisma.driver.updateMany({
      where: { id: driver.id, lastLicenseReminderKey: driver.lastLicenseReminderKey },
      data: { lastLicenseReminderKey: reminderKey },
    });
    if (claimed.count === 0) return;
    try {
      await emailService.sendLicenseReminder(driver.email, driver.name, driver.licenseExpiryDate);
    } catch (error) {
      await prisma.driver.updateMany({
        where: { id: driver.id, lastLicenseReminderKey: reminderKey },
        data: { lastLicenseReminderKey: driver.lastLicenseReminderKey },
      });
      throw error;
    }
  } catch (error) {
    console.error(`[TransitOps Compliance] Scheduled check failed for driver ${driver.id}:`, error);
  }
}

async function runDriverComplianceChecks(): Promise<void> {
  const drivers = await prisma.driver.findMany({
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      licenseExpiryDate: true,
      status: true,
      lastLicenseReminderKey: true,
    },
  });

  const batchSize = 5;
  for (let index = 0; index < drivers.length; index += batchSize) {
    await Promise.all(drivers.slice(index, index + batchSize).map(checkDriverCompliance));
  }
}

export function startDriverComplianceJob(): void {
  if (scheduled) return;
  scheduled = true;
  cron.schedule('0 * * * *', () => {
    void runDriverComplianceChecks().catch((error: unknown) => {
      console.error('[TransitOps Compliance] Hourly driver compliance run failed:', error);
    });
  }, { timezone: 'Asia/Kolkata' });
  console.log('[TransitOps Compliance] Hourly licence and safety-score job scheduled for Asia/Kolkata.');
  void runDriverComplianceChecks().catch((error: unknown) => {
    console.error('[TransitOps Compliance] Startup driver compliance run failed:', error);
  });
}
