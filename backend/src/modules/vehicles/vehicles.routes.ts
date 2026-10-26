import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { realtimeEmitter } from '../../realtime';
import { requireAuth } from '../../middleware/auth';

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

function formatVehicle(v: any) {
  let docs = [];
  if (v.documents) {
    try {
      docs = typeof v.documents === 'string' ? JSON.parse(v.documents) : v.documents;
    } catch {
      docs = [];
    }
  }
  return {
    ...v,
    documents: docs,
  };
}

vehiclesRouter.get('/', async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(vehicles.map(formatVehicle));
});

vehiclesRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const newVehicle = await prisma.vehicle.create({
    data: {
      tenantId: req.user!.tenantId,
      registrationNumber: data.registrationNumber || `MH-${Math.floor(10 + Math.random() * 89)}-XX-1234`,
      name: data.name || 'New Fleet Asset',
      model: data.model || 'Commercial Transport',
      type: data.type || 'Truck',
      maxCapacityKg: Number(data.maxCapacityKg) || 5000,
      currentOdometerKm: Number(data.currentOdometerKm) || 0,
      acquisitionCost: Number(data.acquisitionCost) || 2000000,
      status: data.status || 'Available',
      region: data.region || 'West',
      revenueGenerated: 0,
      fuelEfficiencyKmPerLiter: Number(data.fuelEfficiencyKmPerLiter) || 7.5,
      documents: JSON.stringify(data.documents || [{ type: 'Fitness Certificate', expiryDate: '2028-01-01', status: 'Valid' }]),
    },
  });

  realtimeEmitter.vehicleStatus(newVehicle.id, newVehicle.status, req.user!.tenantId);
  return res.status(201).json(formatVehicle(newVehicle));
});

vehiclesRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updateData: any = { ...data };
  delete updateData.tenantId;
  delete updateData.id;
  if (data.documents) {
    updateData.documents = typeof data.documents === 'string' ? data.documents : JSON.stringify(data.documents);
  }
  if (data.maxCapacityKg !== undefined) updateData.maxCapacityKg = Number(data.maxCapacityKg);
  if (data.currentOdometerKm !== undefined) updateData.currentOdometerKm = Number(data.currentOdometerKm);
  if (data.acquisitionCost !== undefined) updateData.acquisitionCost = Number(data.acquisitionCost);
  if (data.fuelEfficiencyKmPerLiter !== undefined) updateData.fuelEfficiencyKmPerLiter = Number(data.fuelEfficiencyKmPerLiter);

  const result = await prisma.vehicle.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: updateData,
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Vehicle not found.' });
  const updated = await prisma.vehicle.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!updated) return res.status(404).json({ detail: 'Vehicle not found.' });

  realtimeEmitter.vehicleStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(formatVehicle(updated));
});

vehiclesRouter.put('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await prisma.vehicle.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: { status },
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Vehicle not found.' });
  const updated = await prisma.vehicle.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!updated) return res.status(404).json({ detail: 'Vehicle not found.' });

  realtimeEmitter.vehicleStatus(updated.id, updated.status, req.user!.tenantId);
  return res.json(formatVehicle(updated));
});

vehiclesRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await prisma.vehicle.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: { status: 'Retired' },
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Vehicle not found.' });

  realtimeEmitter.vehicleStatus(id, 'Retired', req.user!.tenantId);
  return res.json({ message: 'Vehicle retired successfully' });
});
