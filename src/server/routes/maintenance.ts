import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { realtimeEmitter } from '../realtime';

export const maintenanceRouter = Router();

maintenanceRouter.get('/', async (_req: Request, res: Response) => {
  const records = await prisma.maintenanceRecord.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(records);
});

maintenanceRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });

  const newRecord = await prisma.maintenanceRecord.create({
    data: {
      tenantId: 'demo_tenant',
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
      where: { id: vehicle.id },
      data: { status: 'In Shop' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'In Shop');
  }

  realtimeEmitter.maintenanceUpdated(newRecord);
  realtimeEmitter.notification({
    type: 'warning',
    title: 'Asset Sent to Maintenance',
    message: `${vehicle ? vehicle.name : 'Vehicle'} placed In Shop for ${newRecord.serviceType}.`,
  });

  return res.status(201).json(newRecord);
});

maintenanceRouter.post('/:id/close', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { finalCost, technicianNotes } = req.body;

  const record = await prisma.maintenanceRecord.findUnique({ where: { id } });
  if (!record) return res.status(404).json({ detail: 'Maintenance record not found' });

  const updatedRecord = await prisma.maintenanceRecord.update({
    where: { id },
    data: {
      status: 'Completed',
      completedAt: new Date(),
      completedDate: new Date().toISOString().split('T')[0],
      cost: finalCost !== undefined ? Number(finalCost) : record.cost,
      technicianNotes: technicianNotes || record.technicianNotes,
    },
  });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: record.vehicleId } });
  if (vehicle && vehicle.status === 'In Shop') {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'Available' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available');
  }

  realtimeEmitter.maintenanceUpdated(updatedRecord);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Maintenance Completed',
    message: `Service order closed for ${updatedRecord.vehicleName}. Asset returned to Available fleet.`,
  });

  return res.json(updatedRecord);
});
