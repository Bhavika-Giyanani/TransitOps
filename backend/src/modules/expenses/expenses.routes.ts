import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { realtimeEmitter } from '../../realtime';
import { requireAuth, requireRole } from '../../middleware/auth';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get('/', requireRole('fleet_manager', 'financial_analyst'), async (req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(expenses);
});

expensesRouter.post('/', requireRole('fleet_manager', 'financial_analyst'), async (req: Request, res: Response) => {
  const data = req.body;
  const tenantId = req.user!.tenantId;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
  if (data.vehicleId && !vehicle) return res.status(404).json({ detail: 'Vehicle not found.' });
  if (data.tripId) {
    const trip = await prisma.trip.findFirst({ where: { id: data.tripId, tenantId } });
    if (!trip) return res.status(404).json({ detail: 'Trip not found.' });
  }

  const newExpense = await prisma.expense.create({
    data: {
      tenantId,
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

expensesRouter.delete('/:id', requireRole('fleet_manager', 'financial_analyst'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await prisma.expense.deleteMany({ where: { id, tenantId: req.user!.tenantId } });
  if (result.count === 0) return res.status(404).json({ detail: 'Expense not found.' });
  return res.json({ message: 'Expense deleted successfully' });
});
