import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { requireAuth, requireRole } from '../../middleware/auth';

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
    typeof data.password !== 'string' || data.password.length < 8) {
    return res.status(400).json({ detail: 'A name, email, and password of at least 8 characters are required.' });
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
  const passwordHash = await bcrypt.hash(data.password, 10);

  const newUser = await prisma.user.create({
    data: {
      tenantId: req.user!.tenantId,
      email,
      fullName: data.fullName.trim(),
      passwordHash,
      role,
      isDemoAccount: false,
      contactNumber: data.contactNumber,
      licenseNumber: data.licenseNumber,
      licenseCategory: data.licenseCategory,
      licenseExpiryDate: data.licenseExpiryDate,
    },
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
  if (data.password !== undefined && (typeof data.password !== 'string' || data.password.length < 8)) {
    return res.status(400).json({ detail: 'Password must contain at least 8 characters.' });
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

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.user.updateMany({
      where: { id, tenantId: req.user!.tenantId, role: { not: 'organization_admin' } },
      data: updateData,
    });
    if (result.count === 0) return result;

    await transaction.driver.updateMany({
      where: { tenantId: req.user!.tenantId, identityUserId: id },
      data: {
        email,
        name: updateData.fullName,
        contactNumber: typeof data.contactNumber === 'string' ? data.contactNumber : undefined,
        licenseNumber: typeof data.licenseNumber === 'string' ? data.licenseNumber : undefined,
        licenseCategory: typeof data.licenseCategory === 'string' ? data.licenseCategory : undefined,
        licenseExpiryDate: typeof data.licenseExpiryDate === 'string' ? data.licenseExpiryDate : undefined,
      },
    });
    return result;
  });
  if (updated.count === 0) return res.status(404).json({ detail: 'Organization user not found.' });

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
  const deleted = await prisma.user.deleteMany({
    where: { id, tenantId: req.user!.tenantId, role: { not: 'organization_admin' } },
  });
  if (deleted.count === 0) return res.status(404).json({ detail: 'Organization user not found.' });
  return res.status(204).end();
});
