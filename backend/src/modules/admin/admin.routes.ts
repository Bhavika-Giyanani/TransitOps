import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  licenceExpiryError,
  normalizeIndianPhoneNumber,
  normalizeLicence,
} from '../../../../shared/indianFormats';
import { getIndianDateString } from '../../utils/indianDate';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('organization_admin'));

adminRouter.get('/users', async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.user!.tenantId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      fullName: true,
      role: true,
      isDemoAccount: true,
      contactNumber: true,
      licenseNumber: true,
      licenseCategory: true,
      licenseExpiryDate: true,
      driverId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(users);
});

adminRouter.post('/users', async (req: Request, res: Response) => {
  const data = req.body;
  const roleMap: Record<string, string> = {
    FleetManager: 'fleet_manager',
    Driver: 'driver',
    SafetyOfficer: 'safety_officer',
    FinancialAnalyst: 'financial_analyst',
    fleet_manager: 'fleet_manager',
    driver: 'driver',
    safety_officer: 'safety_officer',
    financial_analyst: 'financial_analyst',
  };
  const emailValidation = z.string().trim().email().safeParse(data.email);
  if (!emailValidation.success || typeof data.fullName !== 'string' || data.fullName.trim().length < 2 ||
    typeof data.password !== 'string' || data.password.length < 10) {
    return res.status(400).json({ detail: 'A name, email, and password of at least 10 characters are required.' });
  }
  const email = emailValidation.data.toLowerCase();
  const existingEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingEmail) {
    return res.status(409).json({ detail: 'That email address is already registered to an account.' });
  }
  const role = data.role ? roleMap[data.role] : 'fleet_manager';
  if (!role) {
    return res.status(400).json({ detail: 'Choose a valid organization role.' });
  }

  let driverDetails: {
    contactNumber: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseExpiryDate: string;
  } | undefined;
  if (role === 'driver') {
    if (typeof data.contactNumber !== 'string' || typeof data.licenseNumber !== 'string' ||
      typeof data.licenseCategory !== 'string' || typeof data.licenseExpiryDate !== 'string') {
      return res.status(400).json({ detail: 'Driver accounts require a mobile number, licence number, category, and expiry date.' });
    }
    const phone = normalizeIndianPhoneNumber(data.contactNumber);
    if (!phone.ok) return res.status(400).json({ detail: phone.error });
    const licence = normalizeLicence(data.licenseNumber);
    if (!licence.ok) return res.status(400).json({ detail: licence.error });
    if (!data.licenseCategory.trim()) return res.status(400).json({ detail: 'Select a licence category.' });
    const expiryError = licenceExpiryError(licence.value, data.licenseExpiryDate);
    if (expiryError) return res.status(400).json({ detail: expiryError });
    const duplicateLicence = await prisma.driver.findFirst({
      where: { tenantId: req.user!.tenantId, licenseNumber: licence.value },
      select: { id: true },
    });
    if (duplicateLicence) return res.status(409).json({ detail: 'That driving licence is already registered in this organization.' });
    driverDetails = {
      contactNumber: phone.value,
      licenseNumber: licence.value,
      licenseCategory: data.licenseCategory.trim(),
      licenseExpiryDate: data.licenseExpiryDate,
    };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const newUser = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        tenantId: req.user!.tenantId,
        email,
        fullName: data.fullName.trim(),
        passwordHash,
        role,
        isDemoAccount: false,
        ...(driverDetails ? driverDetails : {}),
      },
    });
    if (driverDetails) {
      const expired = driverDetails.licenseExpiryDate < getIndianDateString();
      const driver = await transaction.driver.create({
        data: {
          tenantId: req.user!.tenantId,
          name: user.fullName,
          email: user.email,
          ...driverDetails,
          safetyScore: 100,
          status: expired ? 'Suspended' : 'Available',
          identityUserId: user.id,
        },
      });
      return transaction.user.update({ where: { id: user.id }, data: { driverId: driver.id } });
    }
    return user;
  });

  return res.status(201).json({
    id: newUser.id,
    tenantId: newUser.tenantId,
    email: newUser.email,
    fullName: newUser.fullName,
    role: newUser.role,
    driverId: newUser.driverId,
    contactNumber: newUser.contactNumber,
    licenseNumber: newUser.licenseNumber,
    licenseCategory: newUser.licenseCategory,
    licenseExpiryDate: newUser.licenseExpiryDate,
    createdAt: newUser.createdAt,
    isDemoAccount: newUser.isDemoAccount,
  });
});

adminRouter.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const targetUser = await prisma.user.findFirst({
    where: { id, tenantId: req.user!.tenantId, role: { not: 'organization_admin' } },
  });
  if (!targetUser) return res.status(404).json({ detail: 'Organization user not found.' });
  const roleMap: Record<string, string> = {
    FleetManager: 'fleet_manager',
    Driver: 'driver',
    SafetyOfficer: 'safety_officer',
    FinancialAnalyst: 'financial_analyst',
    fleet_manager: 'fleet_manager',
    driver: 'driver',
    safety_officer: 'safety_officer',
    financial_analyst: 'financial_analyst',
  };
  const role = data.role === undefined ? undefined : roleMap[data.role];
  if (data.role !== undefined && !role) {
    return res.status(400).json({ detail: 'Choose a valid organization role.' });
  }
  const emailValidation = z.string().trim().email().safeParse(data.email);
  if (!emailValidation.success) {
    return res.status(400).json({ detail: 'Enter a valid email address.' });
  }
  const email = emailValidation.data.toLowerCase();
  const existingEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingEmail && existingEmail.id !== id) {
    return res.status(409).json({ detail: 'That email address is already registered to another account.' });
  }
  if (data.password !== undefined && (typeof data.password !== 'string' || data.password.length < 10)) {
    return res.status(400).json({ detail: 'Password must contain at least 10 characters.' });
  }

  const updateData: Prisma.UserUpdateManyMutationInput = {
    fullName: typeof data.fullName === 'string' ? data.fullName.trim() : undefined,
    email,
    role,
    contactNumber: data.contactNumber,
    licenseNumber: data.licenseNumber,
    licenseCategory: data.licenseCategory,
    licenseExpiryDate: data.licenseExpiryDate,
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  let driverDetails: {
    contactNumber: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseExpiryDate: string;
  } | undefined;
  if ((role ?? targetUser.role) === 'driver') {
    if (typeof data.contactNumber !== 'string' || typeof data.licenseNumber !== 'string' ||
      typeof data.licenseCategory !== 'string' || typeof data.licenseExpiryDate !== 'string') {
      return res.status(400).json({ detail: 'Driver accounts require a mobile number, licence number, category, and expiry date.' });
    }
    const phone = normalizeIndianPhoneNumber(data.contactNumber);
    if (!phone.ok) return res.status(400).json({ detail: phone.error });
    const licence = normalizeLicence(data.licenseNumber);
    if (!licence.ok) return res.status(400).json({ detail: licence.error });
    if (!data.licenseCategory.trim()) return res.status(400).json({ detail: 'Select a licence category.' });
    const expiryError = licenceExpiryError(licence.value, data.licenseExpiryDate);
    if (expiryError) return res.status(400).json({ detail: expiryError });
    const duplicateLicence = await prisma.driver.findFirst({
      where: { tenantId: req.user!.tenantId, licenseNumber: licence.value, NOT: { identityUserId: id } },
      select: { id: true },
    });
    if (duplicateLicence) return res.status(409).json({ detail: 'That driving licence is already registered in this organization.' });
    driverDetails = {
      contactNumber: phone.value,
      licenseNumber: licence.value,
      licenseCategory: data.licenseCategory.trim(),
      licenseExpiryDate: data.licenseExpiryDate,
    };
    updateData.contactNumber = driverDetails.contactNumber;
    updateData.licenseNumber = driverDetails.licenseNumber;
    updateData.licenseCategory = driverDetails.licenseCategory;
    updateData.licenseExpiryDate = driverDetails.licenseExpiryDate;
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findFirst({
      where: { id, tenantId: req.user!.tenantId, role: { not: 'organization_admin' } },
    });
    if (!existingUser) return null;

    const user = await transaction.user.update({ where: { id }, data: updateData });
    if (driverDetails) {
      const driver = await transaction.driver.findFirst({
        where: { tenantId: req.user!.tenantId, identityUserId: id },
      });
      const expired = driverDetails.licenseExpiryDate < getIndianDateString();
      const driverData = {
        ...driverDetails,
        email,
        name: typeof data.fullName === 'string' ? data.fullName.trim() : targetUser.fullName,
        ...(expired ? { status: 'Suspended' } : {}),
      };
      const linkedDriver = driver
        ? await transaction.driver.update({ where: { id: driver.id }, data: driverData })
        : await transaction.driver.create({
          data: {
            tenantId: req.user!.tenantId,
            ...driverData,
            safetyScore: 100,
            status: expired ? 'Suspended' : 'Available',
            identityUserId: id,
          },
        });
      return transaction.user.update({ where: { id: user.id }, data: { driverId: linkedDriver.id } });
    }
    if (typeof data.role === 'string' && role !== 'driver') {
      await transaction.driver.updateMany({
        where: { tenantId: req.user!.tenantId, identityUserId: id },
        data: { identityUserId: null },
      });
      return transaction.user.update({ where: { id: user.id }, data: { driverId: null } });
    }
    return user;
  });
  if (!updated) return res.status(404).json({ detail: 'Organization user not found.' });

  const user = await prisma.user.findFirst({
    where: { id, tenantId: req.user!.tenantId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      fullName: true,
      role: true,
      contactNumber: true,
      licenseNumber: true,
      licenseCategory: true,
      licenseExpiryDate: true,
      driverId: true,
      createdAt: true,
      isDemoAccount: true,
    },
  });
  return res.json(user);
});

adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findFirst({
      where: { id, tenantId: req.user!.tenantId, role: { not: 'organization_admin' } },
      select: { id: true },
    });
    if (!user) return false;
    await transaction.driver.updateMany({
      where: { tenantId: req.user!.tenantId, identityUserId: id },
      data: { identityUserId: null },
    });
    await transaction.user.delete({ where: { id } });
    return true;
  });
  if (!deleted) return res.status(404).json({ detail: 'Organization user not found.' });
  return res.status(204).end();
});
