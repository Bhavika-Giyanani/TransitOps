import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';

export const adminRouter = Router();

adminRouter.get('/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(users);
});

adminRouter.post('/users', async (req: Request, res: Response) => {
  const data = req.body;
  const passwordHash = await bcrypt.hash(data.password || 'TransitOps@2026', 10);

  const newUser = await prisma.user.create({
    data: {
      tenantId: 'demo_tenant',
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      role: data.role || 'fleet_manager',
      isDemoAccount: false,
      contactNumber: data.contactNumber,
      licenseNumber: data.licenseNumber,
      licenseCategory: data.licenseCategory,
      licenseExpiryDate: data.licenseExpiryDate,
    },
  });

  return res.status(201).json(newUser);
});

adminRouter.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updateData: any = {
    fullName: data.fullName,
    role: data.role,
    contactNumber: data.contactNumber,
    licenseNumber: data.licenseNumber,
    licenseCategory: data.licenseCategory,
    licenseExpiryDate: data.licenseExpiryDate,
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return res.json(updated);
});

adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  return res.status(204).end();
});
