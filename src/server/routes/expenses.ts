import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { realtimeEmitter } from '../realtime';

export const expensesRouter = Router();

expensesRouter.get('/', async (_req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(expenses);
});

expensesRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });

  const newExpense = await prisma.expense.create({
    data: {
      tenantId: 'demo_tenant',
      vehicleId: data.vehicleId,
      vehicleRegNumber: vehicle ? vehicle.registrationNumber : undefined,
      vehicleName: vehicle ? vehicle.name : undefined,
      tripId: data.tripId,
      type: data.type || 'Other',
      category: data.category || data.type,
      amount: Number(data.amount) || Number(data.cost) || 0,
      cost: Number(data.amount) || Number(data.cost) || 0,
      date: data.expenseDate || data.date || new Date().toISOString(),
      expenseDate: data.expenseDate || data.date || new Date().toISOString(),
      liters: data.liters ? Number(data.liters) : undefined,
      fuelLiters: data.fuelLiters ? Number(data.fuelLiters) : undefined,
      odometerReading: data.odometerReading ? Number(data.odometerReading) : undefined,
      description: data.description || data.notes || '',
      notes: data.notes || data.description || '',
    },
  });

  realtimeEmitter.expenseUpdated(newExpense);
  return res.status(201).json(newExpense);
});

expensesRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.expense.delete({ where: { id } });
  return res.json({ message: 'Expense deleted successfully' });
});
