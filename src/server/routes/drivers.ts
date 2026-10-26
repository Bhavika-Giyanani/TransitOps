import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { calculateDriverSafetyScore } from '../services/safetyScore';
import { emailService } from '../services/email';
import { realtimeEmitter } from '../realtime';

export const driversRouter = Router();

driversRouter.get('/', async (_req: Request, res: Response) => {
  const drivers = await prisma.driver.findMany({
    orderBy: { name: 'asc' },
  });
  return res.json(drivers);
});

driversRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const newDriver = await prisma.driver.create({
    data: {
      tenantId: 'demo_tenant',
      name: data.name,
      licenseNumber: data.licenseNumber,
      licenseCategory: data.licenseCategory || 'HGMV',
      licenseExpiryDate: data.licenseExpiryDate || '2028-01-01',
      contactNumber: data.contactNumber || '+91 99999 99999',
      email: data.email || `driver-${Date.now()}@transitops.com`,
      safetyScore: 100,
      status: data.status || 'Available',
      tripsCount: 0,
      incidentHistoryCount: 0,
      totalTripsCompleted: 0,
    },
  });

  realtimeEmitter.driverStatus(newDriver.id, newDriver.status);
  return res.status(201).json(newDriver);
});

driversRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updated = await prisma.driver.update({
    where: { id },
    data,
  });

  await calculateDriverSafetyScore(updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status);
  return res.json(updated);
});

driversRouter.put('/:id/toggle-suspension', async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found' });

  const newStatus = driver.status === 'Suspended' ? 'Available' : 'Suspended';
  const updated = await prisma.driver.update({
    where: { id },
    data: { status: newStatus },
  });

  await calculateDriverSafetyScore(updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status);
  return res.json(updated);
});

driversRouter.post('/:id/send-license-reminder', async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found' });

  await emailService.sendLicenseReminder(driver.email, driver.name, driver.licenseExpiryDate);

  realtimeEmitter.notification({
    type: 'info',
    title: 'Licence Renewal Alert Sent',
    message: `Compliance reminder emailed to ${driver.name} (${driver.email}).`,
  });

  return res.json({
    message: `Licence renewal alert notification sent to ${driver.name} (${driver.email}).`,
  });
});

driversRouter.post('/:id/incidents', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await prisma.driver.update({
    where: { id },
    data: {
      incidentHistoryCount: { increment: 1 },
    },
  });

  await calculateDriverSafetyScore(updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status);
  realtimeEmitter.notification({
    type: 'warning',
    title: 'Incident Recorded',
    message: `Safety violation recorded for ${updated.name}. Safety score recalculated.`,
  });

  return res.json(updated);
});

driversRouter.get('/:id/safety-score', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const scoreBreakdown = await calculateDriverSafetyScore(id);
    return res.json(scoreBreakdown);
  } catch (err: any) {
    return res.status(404).json({ detail: err.message || 'Driver not found' });
  }
});
