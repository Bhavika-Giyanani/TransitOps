import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { realtimeEmitter } from '../../realtime';
import { requireAuth, requireRole } from '../../middleware/auth';
import { normalizeRegistration } from '../../../../shared/indianFormats';

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

vehiclesRouter.get('/', requireRole('fleet_manager', 'driver', 'safety_officer', 'financial_analyst'), async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(vehicles.map(formatVehicle));
});

vehiclesRouter.post('/', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const data = req.body;
  const registration = normalizeRegistration(typeof data.registrationNumber === 'string' ? data.registrationNumber : '');
  if (!registration.ok) return res.status(400).json({ detail: registration.error });
  const duplicate = await prisma.vehicle.findFirst({
    where: { tenantId: req.user!.tenantId, registrationNumber: registration.value },
    select: { id: true },
  });
  if (duplicate) return res.status(409).json({ detail: 'That vehicle registration is already recorded in this organization.' });
  const newVehicle = await prisma.vehicle.create({
    data: {
      tenantId: req.user!.tenantId,
      registrationNumber: registration.value,
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

vehiclesRouter.put('/:id', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updateData: any = { ...data };
  delete updateData.tenantId;
  delete updateData.id;
  if (data.registrationNumber !== undefined) {
    if (typeof data.registrationNumber !== 'string') return res.status(400).json({ detail: 'Enter a valid Indian vehicle registration number.' });
    const registration = normalizeRegistration(data.registrationNumber);
    if (!registration.ok) return res.status(400).json({ detail: registration.error });
    const duplicate = await prisma.vehicle.findFirst({
      where: {
        tenantId: req.user!.tenantId,
        registrationNumber: registration.value,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) return res.status(409).json({ detail: 'That vehicle registration is already recorded in this organization.' });
    updateData.registrationNumber = registration.value;
  }
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

vehiclesRouter.put('/:id/status', requireRole('fleet_manager'), async (req: Request, res: Response) => {
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

vehiclesRouter.delete('/:id', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await prisma.vehicle.updateMany({
    where: { id, tenantId: req.user!.tenantId },
    data: { status: 'Retired' },
  });
  if (result.count === 0) return res.status(404).json({ detail: 'Vehicle not found.' });

  realtimeEmitter.vehicleStatus(id, 'Retired', req.user!.tenantId);
  return res.json({ message: 'Vehicle retired successfully' });
});
