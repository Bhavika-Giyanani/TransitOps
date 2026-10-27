import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { realtimeEmitter } from '../../realtime';
import { requireAuth, requireRole } from '../../middleware/auth';

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAuth);

maintenanceRouter.get('/', requireRole('fleet_manager', 'safety_officer', 'financial_analyst'), async (req: Request, res: Response) => {
  const records = await prisma.maintenanceRecord.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(records);
});

maintenanceRouter.post('/', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const data = req.body;
  const tenantId = req.user!.tenantId;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
  if (!vehicle) return res.status(404).json({ detail: 'Vehicle not found.' });

  const newRecord = await prisma.maintenanceRecord.create({
    data: {
      tenantId,
      vehicleId: data.vehicleId,
      vehicleRegNumber: vehicle ? vehicle.registrationNumber : 'UNKNOWN',
      vehicleName: vehicle ? vehicle.name : 'Unknown Asset',
      serviceType: data.serviceType || 'Inspection & Service',
      description: data.description || '',
      cost: Number(data.cost) || 0,
      date: new Date().toISOString().split('T')[0],
      startDate: new Date(),
      status: 'Active',
      technicianNotes: data.technicianNotes || '',
    },
  });

  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'In Shop' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'In Shop', tenantId);
  }

  realtimeEmitter.maintenanceUpdated(newRecord);
  realtimeEmitter.notification({
    type: 'warning',
    title: 'Asset Sent to Maintenance',
    message: `${vehicle ? vehicle.name : 'Vehicle'} placed In Shop for ${newRecord.serviceType}.`,
    tenantId,
  });

  return res.status(201).json(newRecord);
});

maintenanceRouter.post('/:id/close', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { finalCost, technicianNotes } = req.body;

  const record = await prisma.maintenanceRecord.findFirst({ where: { id, tenantId: req.user!.tenantId } });
  if (!record) return res.status(404).json({ detail: 'Maintenance record not found' });

  const tenantId = req.user!.tenantId;
  const updatedRecord = await prisma.maintenanceRecord.update({
    where: { id, tenantId },
    data: {
      status: 'Completed',
      completedAt: new Date(),
      completedDate: new Date().toISOString().split('T')[0],
      cost: finalCost !== undefined ? Number(finalCost) : record.cost,
      technicianNotes: technicianNotes || record.technicianNotes,
    },
  });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: record.vehicleId, tenantId } });
  if (vehicle && vehicle.status === 'In Shop') {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'Available' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available', tenantId);
  }

  realtimeEmitter.maintenanceUpdated(updatedRecord);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Maintenance Completed',
    message: `Service order closed for ${updatedRecord.vehicleName}. Asset returned to Available fleet.`,
    tenantId,
  });

  return res.json(updatedRecord);
});
