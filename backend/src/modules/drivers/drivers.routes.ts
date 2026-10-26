import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { calculateDriverSafetyScore } from '../../services/safetyScore';
import { emailService } from '../../services/email';
import { realtimeEmitter } from '../../realtime';
import { requireAuth } from '../../middleware/auth';

export const driversRouter = Router();
driversRouter.use(requireAuth);

driversRouter.get('/', async (req: Request, res: Response) => {
  const drivers = await prisma.driver.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { name: 'asc' },
  });
  return res.json(drivers);
});

driversRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const newDriver = await prisma.driver.create({
    data: {
      tenantId: req.user!.tenantId,
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

  realtimeEmitter.driverStatus(newDriver.id, newDriver.status, req.user!.tenantId);
  return res.status(201).json(newDriver);
});

driversRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updateData = { ...data };
  delete updateData.tenantId;
  delete updateData.id;
  const result = await prisma.driver.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: updateData,
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Driver not found.' });
  const updated = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!updated) return res.status(404).json({ detail: 'Driver not found.' });

  await calculateDriverSafetyScore(req.user!.tenantId, updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(updated);
});

driversRouter.put('/:id/toggle-suspension', async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found' });

  const newStatus = driver.status === 'Suspended' ? 'Available' : 'Suspended';
  const updated = await prisma.driver.update({
    where: { id, tenantId: req.user!.tenantId },
    data: { status: newStatus },
  });

  await calculateDriverSafetyScore(req.user!.tenantId, updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(updated);
});

driversRouter.post('/:id/send-license-reminder', async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found' });

  try {
    await emailService.sendLicenseReminder(driver.email, driver.name, driver.licenseExpiryDate);
  } catch (err) {
    console.error('[TransitOps Drivers] Licence reminder email could not be delivered:', err);
    return res.status(502).json({ detail: 'Licence reminder could not be delivered. Check the mail service and retry.' });
  }

  realtimeEmitter.notification({
    type: 'info',
    title: 'Licence Renewal Alert Sent',
    message: `Compliance reminder emailed to ${driver.name} (${driver.email}).`,
    tenantId: req.user!.tenantId,
  });

  return res.json({
    message: `Licence renewal alert notification sent to ${driver.name} (${driver.email}).`,
  });
});

driversRouter.post('/:id/incidents', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await prisma.driver.update({
    where: { id, tenantId: req.user!.tenantId },
    data: {
      incidentHistoryCount: { increment: 1 },
    },
  });

  await calculateDriverSafetyScore(req.user!.tenantId, updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status, req.user!.tenantId);
  realtimeEmitter.notification({
    type: 'warning',
    title: 'Incident Recorded',
    message: `Safety violation recorded for ${updated.name}. Safety score recalculated.`,
    tenantId: req.user!.tenantId,
  });

  return res.json(updated);
});

driversRouter.get('/:id/safety-score', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const scoreBreakdown = await calculateDriverSafetyScore(req.user!.tenantId, id);
    return res.json(scoreBreakdown);
  } catch (err: any) {
    return res.status(404).json({ detail: err.message || 'Driver not found' });
  }
});
