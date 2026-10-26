import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { realtimeEmitter } from '../realtime';

export const vehiclesRouter = Router();

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

vehiclesRouter.get('/', async (_req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(vehicles.map(formatVehicle));
});

vehiclesRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const newVehicle = await prisma.vehicle.create({
    data: {
      tenantId: 'demo_tenant',
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

  realtimeEmitter.vehicleStatus(newVehicle.id, newVehicle.status);
  return res.status(201).json(formatVehicle(newVehicle));
});

vehiclesRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updateData: any = { ...data };
  if (data.documents) {
    updateData.documents = typeof data.documents === 'string' ? data.documents : JSON.stringify(data.documents);
  }
  if (data.maxCapacityKg !== undefined) updateData.maxCapacityKg = Number(data.maxCapacityKg);
  if (data.currentOdometerKm !== undefined) updateData.currentOdometerKm = Number(data.currentOdometerKm);
  if (data.acquisitionCost !== undefined) updateData.acquisitionCost = Number(data.acquisitionCost);
  if (data.fuelEfficiencyKmPerLiter !== undefined) updateData.fuelEfficiencyKmPerLiter = Number(data.fuelEfficiencyKmPerLiter);

  const updated = await prisma.vehicle.update({
    where: { id },
    data: updateData,
  });

  realtimeEmitter.vehicleStatus(updated.id, updated.status);
  return res.json(formatVehicle(updated));
});

vehiclesRouter.put('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await prisma.vehicle.update({
    where: { id },
    data: { status },
  });

  realtimeEmitter.vehicleStatus(updated.id, updated.status);
  return res.json(formatVehicle(updated));
});

vehiclesRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await prisma.vehicle.update({
    where: { id },
    data: { status: 'Retired' },
  });

  realtimeEmitter.vehicleStatus(updated.id, 'Retired');
  return res.json({ message: 'Vehicle retired successfully' });
});
