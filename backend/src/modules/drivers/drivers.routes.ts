import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../db';
import { calculateDriverSafetyScore } from '../../services/safetyScore';
import { emailService } from '../../services/email';
import { realtimeEmitter } from '../../realtime';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getIndianDateString } from '../../utils/indianDate';
import { ensureDriverProfile } from './driverAccounts';
import {
  licenceExpiryError,
  normalizeIndianPhoneNumber,
  normalizeLicence,
} from '../../../../shared/indianFormats';

export const driversRouter = Router();
driversRouter.use(requireAuth);

const driverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(256).transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(128),
  licenseNumber: z.string().trim().min(1).max(20),
  licenseCategory: z.string().trim().min(1).max(20),
  licenseExpiryDate: z.string().date(),
  contactNumber: z.string().trim().min(1).max(32),
});

function isExpired(expiryDate: string): boolean {
  return expiryDate < getIndianDateString();
}

driversRouter.get('/', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const driverAccounts = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId, role: 'driver' },
    select: {
      id: true,
      tenantId: true,
      role: true,
      email: true,
      fullName: true,
      driverId: true,
      contactNumber: true,
      licenseNumber: true,
      licenseCategory: true,
      licenseExpiryDate: true,
    },
  });
  for (const account of driverAccounts) {
    if (!await ensureDriverProfile(account)) {
      return res.status(409).json({
        detail: 'A driver login is missing valid phone or licence details. Ask the organization administrator to update that account.',
      });
    }
  }

  const drivers = await prisma.driver.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { name: 'asc' },
  });
  const currentDate = getIndianDateString();
  const currentDrivers = await Promise.all(drivers.map(async (driver) => {
    let status = driver.status;
    if (driver.licenseExpiryDate < currentDate && status !== 'Suspended') {
      await prisma.driver.updateMany({
        where: { id: driver.id, tenantId: req.user!.tenantId },
        data: { status: 'Suspended' },
      });
      status = 'Suspended';
      realtimeEmitter.driverStatus(driver.id, status, req.user!.tenantId);
    }
    const score = await calculateDriverSafetyScore(req.user!.tenantId, driver.id);
    return { ...driver, status, safetyScore: score.score };
  }));
  return res.json(currentDrivers);
});

driversRouter.post('/', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const validation = driverSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ detail: validation.error.issues.map((issue) => issue.message).join(' ') });
  }

  const data = validation.data;
  const phone = normalizeIndianPhoneNumber(data.contactNumber);
  if (!phone.ok) return res.status(400).json({ detail: phone.error });

  const licence = normalizeLicence(data.licenseNumber);
  if (!licence.ok) return res.status(400).json({ detail: licence.error });
  const expiryError = licenceExpiryError(licence.value, data.licenseExpiryDate);
  if (expiryError) return res.status(400).json({ detail: expiryError });

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingUser) return res.status(409).json({ detail: 'That email address is already registered to an account.' });

  const existingLicence = await prisma.driver.findFirst({
    where: { tenantId: req.user!.tenantId, licenseNumber: licence.value },
    select: { id: true },
  });
  if (existingLicence) return res.status(409).json({ detail: 'That driving licence is already registered in this organization.' });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const expired = isExpired(data.licenseExpiryDate);
  const created = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        tenantId: req.user!.tenantId,
        email: data.email,
        passwordHash,
        fullName: data.name,
        role: 'driver',
        isDemoAccount: false,
        contactNumber: phone.value,
        licenseNumber: licence.value,
        licenseCategory: data.licenseCategory,
        licenseExpiryDate: data.licenseExpiryDate,
      },
    });
    const driver = await transaction.driver.create({
      data: {
        tenantId: req.user!.tenantId,
        name: data.name,
        email: data.email,
        licenseNumber: licence.value,
        licenseCategory: data.licenseCategory,
        licenseExpiryDate: data.licenseExpiryDate,
        contactNumber: phone.value,
        safetyScore: 100,
        status: expired ? 'Suspended' : 'Available',
        identityUserId: user.id,
      },
    });
    await transaction.user.update({ where: { id: user.id }, data: { driverId: driver.id } });
    return driver;
  });

  await calculateDriverSafetyScore(req.user!.tenantId, created.id);
  realtimeEmitter.driverStatus(created.id, created.status, req.user!.tenantId);
  return res.status(201).json(created);
});

driversRouter.put('/:id', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  const currentDriver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!currentDriver) return res.status(404).json({ detail: 'Driver not found.' });

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 100)
      return res.status(400).json({ detail: 'Driver name must contain 2 to 100 characters.' });
    updateData.name = data.name.trim();
  }
  if (data.email !== undefined) {
    const parsed = z.string().trim().email().max(256).safeParse(data.email);
    if (!parsed.success) return res.status(400).json({ detail: 'Enter a valid driver email address.' });
    const email = parsed.data.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing && existing.id !== currentDriver.identityUserId) {
      return res.status(409).json({ detail: 'That email address is already registered to another account.' });
    }
    updateData.email = email;
  }
  if (data.contactNumber !== undefined) {
    if (typeof data.contactNumber !== 'string') return res.status(400).json({ detail: 'Enter a valid Indian mobile number.' });
    const phone = normalizeIndianPhoneNumber(data.contactNumber);
    if (!phone.ok) return res.status(400).json({ detail: phone.error });
    updateData.contactNumber = phone.value;
  }
  if (data.licenseNumber !== undefined) {
    if (typeof data.licenseNumber !== 'string') return res.status(400).json({ detail: 'Enter a valid Indian driving licence number.' });
    const licence = normalizeLicence(data.licenseNumber);
    if (!licence.ok) return res.status(400).json({ detail: licence.error });
    const duplicate = await prisma.driver.findFirst({
      where: { tenantId: req.user!.tenantId, licenseNumber: licence.value, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) return res.status(409).json({ detail: 'That driving licence is already registered in this organization.' });
    updateData.licenseNumber = licence.value;
  }
  if (data.licenseCategory !== undefined) {
    if (typeof data.licenseCategory !== 'string' || !data.licenseCategory.trim())
      return res.status(400).json({ detail: 'Select a licence category.' });
    updateData.licenseCategory = data.licenseCategory.trim();
  }
  if (data.licenseExpiryDate !== undefined) {
    if (typeof data.licenseExpiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.licenseExpiryDate))
      return res.status(400).json({ detail: 'Enter a valid licence expiry date.' });
    updateData.licenseExpiryDate = data.licenseExpiryDate;
  }
  if (typeof updateData.licenseNumber === 'string' || typeof updateData.licenseExpiryDate === 'string') {
    const expiryDate = typeof updateData.licenseExpiryDate === 'string'
      ? updateData.licenseExpiryDate
      : currentDriver.licenseExpiryDate;
    const error = licenceExpiryError(
      typeof updateData.licenseNumber === 'string' ? updateData.licenseNumber : currentDriver.licenseNumber,
      expiryDate,
    );
    if (error) return res.status(400).json({ detail: error });
    if (isExpired(expiryDate)) updateData.status = 'Suspended';
  }

  const result = await prisma.driver.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: updateData,
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Driver not found.' });

  const updated = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!updated) return res.status(404).json({ detail: 'Driver not found.' });
  if (updated.identityUserId) {
    const userData: Record<string, string> = {};
    if (typeof updateData.name === 'string') userData.fullName = updateData.name;
    if (typeof updateData.email === 'string') userData.email = updateData.email;
    if (typeof updateData.contactNumber === 'string') userData.contactNumber = updateData.contactNumber;
    if (typeof updateData.licenseNumber === 'string') userData.licenseNumber = updateData.licenseNumber;
    if (typeof updateData.licenseCategory === 'string') userData.licenseCategory = updateData.licenseCategory;
    if (typeof updateData.licenseExpiryDate === 'string') userData.licenseExpiryDate = updateData.licenseExpiryDate;
    if (Object.keys(userData).length) {
      await prisma.user.updateMany({
        where: { id: updated.identityUserId, tenantId: req.user!.tenantId },
        data: userData,
      });
    }
  }

  await calculateDriverSafetyScore(req.user!.tenantId, updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(updated);
});

driversRouter.put('/:id/toggle-suspension', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found.' });

  const newStatus = driver.status === 'Suspended' ? 'Available' : 'Suspended';
  if (newStatus === 'Available' && isExpired(driver.licenseExpiryDate)) {
    return res.status(400).json({ detail: 'This driver cannot be reinstated until their licence expiry date is updated.' });
  }
  const updated = await prisma.driver.update({
    where: { id },
    data: { status: newStatus },
  });

  await calculateDriverSafetyScore(req.user!.tenantId, updated.id);
  realtimeEmitter.driverStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(updated);
});

driversRouter.post('/:id/send-license-reminder', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const driver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found.' });
  if (!driver.email || driver.email.toLowerCase().endsWith('@transitops.com')) {
    return res.status(400).json({ detail: 'Add the driver’s real email address before sending a licence reminder.' });
  }

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

  return res.json({ message: `Licence renewal alert notification sent to ${driver.name} (${driver.email}).` });
});

driversRouter.post('/:id/incidents', requireRole('safety_officer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await prisma.driver.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: { incidentHistoryCount: { increment: 1 } },
  });
  if (updated.count === 0) return res.status(404).json({ detail: 'Driver not found.' });
  const driver = await prisma.driver.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!driver) return res.status(404).json({ detail: 'Driver not found.' });

  await calculateDriverSafetyScore(req.user!.tenantId, driver.id);
  realtimeEmitter.driverStatus(driver.id, driver.status, req.user!.tenantId);
  realtimeEmitter.notification({
    type: 'warning',
    title: 'Incident Recorded',
    message: `Safety violation recorded for ${driver.name}. Safety score recalculated.`,
    tenantId: req.user!.tenantId,
  });

  return res.json(driver);
});

driversRouter.get('/:id/safety-score', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const scoreBreakdown = await calculateDriverSafetyScore(req.user!.tenantId, id);
    return res.json(scoreBreakdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Driver not found.';
    return res.status(404).json({ detail: message });
  }
});
