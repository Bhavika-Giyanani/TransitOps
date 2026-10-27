import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { calculateDriverSafetyScore } from '../../services/safetyScore';
import { realtimeEmitter } from '../../realtime';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getIndianDateString } from '../../utils/indianDate';
import { findDriverForUser } from '../drivers/driverIdentity';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

const createTripSchema = z.object({
  source: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200),
  vehicleId: z.string().trim().min(1),
  driverId: z.string().trim().min(1),
  cargoWeightKg: z.coerce.number().finite().positive(),
  plannedDistanceKm: z.coerce.number().finite().positive(),
  revenue: z.coerce.number().finite().nonnegative().optional(),
});

const completeTripSchema = z.object({
  finalOdometerKm: z.coerce.number().finite().nonnegative(),
  fuelConsumedLiters: z.coerce.number().finite().nonnegative(),
});

tripsRouter.get('/', async (req: Request, res: Response) => {
  const where: { tenantId: string; driverId?: string } = { tenantId: req.user!.tenantId };
  if (req.user!.role === 'driver') {
    const driver = await findDriverForUser(req.user!.id, req.user!.tenantId);
    if (!driver) return res.json([]);
    where.driverId = driver.id;
  }
  const trips = await prisma.trip.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return res.json(trips);
});

tripsRouter.post('/', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const validation = createTripSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ detail: validation.error.issues.map((issue) => issue.message).join(' ') });
  }
  const data = validation.data;
  const tenantId = req.user!.tenantId;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
  const driver = await prisma.driver.findFirst({ where: { id: data.driverId, tenantId } });
  if (!vehicle) return res.status(404).json({ detail: 'Select a vehicle in your organization.' });
  if (!driver) return res.status(404).json({ detail: 'Select a driver in your organization.' });
  if (vehicle.status !== 'Available') return res.status(400).json({ detail: 'Only available vehicles can be assigned to a trip.' });
  if (data.cargoWeightKg > vehicle.maxCapacityKg) {
    return res.status(400).json({ detail: `Cargo weight exceeds the selected vehicle's ${vehicle.maxCapacityKg} kg capacity.` });
  }
  if (!['Available', 'On Duty'].includes(driver.status)) return res.status(400).json({ detail: 'Only available drivers can be assigned to a trip.' });
  if (driver.licenseExpiryDate < getIndianDateString()) {
    await prisma.driver.update({ where: { id: driver.id }, data: { status: 'Suspended' } });
    realtimeEmitter.driverStatus(driver.id, 'Suspended', tenantId);
    return res.status(400).json({ detail: 'The driver has an expired licence and has been suspended.' });
  }

  const newTrip = await prisma.trip.create({
    data: {
      tenantId,
      tripCode: `TRIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      source: data.source,
      destination: data.destination,
      vehicleId: data.vehicleId,
      vehicleRegNumber: vehicle.registrationNumber,
      vehicleName: vehicle.name,
      driverId: data.driverId,
      driverName: driver.name,
      cargoWeightKg: data.cargoWeightKg,
      plannedDistanceKm: data.plannedDistanceKm,
      revenue: data.revenue ?? 0,
      status: 'Draft',
    },
  });

  return res.status(201).json(newTrip);
});

tripsRouter.post('/:id/dispatch', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });
  if (trip.status !== 'Draft') return res.status(400).json({ detail: 'Only draft trips can be dispatched.' });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });

  if (vehicle && vehicle.status === 'In Shop') {
    return res.status(400).json({ detail: 'Vehicle is currently In Shop for maintenance and cannot be dispatched.' });
  }
  if (driver && driver.status === 'Suspended') {
    return res.status(400).json({ detail: 'Driver is currently Suspended and cannot be dispatched.' });
  }
  if (!driver || driver.licenseExpiryDate < getIndianDateString()) {
    if (driver) {
      await prisma.driver.update({ where: { id: driver.id }, data: { status: 'Suspended' } });
      realtimeEmitter.driverStatus(driver.id, 'Suspended', tenantId);
    }
    return res.status(400).json({ detail: 'The assigned driver has no valid current licence and cannot be dispatched.' });
  }
  if (!vehicle || vehicle.status !== 'Available') {
    return res.status(400).json({ detail: 'The assigned vehicle is not available for dispatch.' });
  }

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: {
      status: 'Dispatched',
      dispatchedAt: new Date(),
    },
  });

  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'On Trip', tenantId);
  }

  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.driverStatus(driver.id, 'On Trip', tenantId);
  }

  realtimeEmitter.tripDispatched(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Dispatched',
    message: 'A fleet trip has been dispatched.',
    tenantId,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/complete', requireRole('fleet_manager', 'driver'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = completeTripSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ detail: validation.error.issues.map((issue) => issue.message).join(' ') });
  }
  const { finalOdometerKm, fuelConsumedLiters } = validation.data;

  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });
  if (req.user!.role === 'driver') {
    const driver = await findDriverForUser(req.user!.id, req.user!.tenantId);
    if (!driver || trip.driverId !== driver.id) return res.status(403).json({ detail: 'You can only complete trips assigned to your driver account.' });
    if (trip.status !== 'Dispatched') return res.status(400).json({ detail: 'Only your dispatched trips can be completed.' });
  } else if (trip.status !== 'Dispatched') {
    return res.status(400).json({ detail: 'Only dispatched trips can be completed.' });
  }

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  if (!vehicle) return res.status(404).json({ detail: 'Assigned vehicle not found.' });
  if (finalOdometerKm < vehicle.currentOdometerKm) {
    return res.status(400).json({ detail: 'Final odometer cannot be lower than the vehicle starting odometer.' });
  }

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: {
      status: 'Completed',
      completedAt: new Date(),
      finalOdometerKm,
      fuelConsumedLiters,
    },
  });

  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: {
        status: 'Available',
        currentOdometerKm: finalOdometerKm,
        revenueGenerated: { increment: trip.revenue || 0 },
      },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available', tenantId);
  }

  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });
  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: {
        status: 'Available',
        tripsCount: { increment: 1 },
        totalTripsCompleted: { increment: 1 },
      },
    });
    await calculateDriverSafetyScore(tenantId, driver.id);
    realtimeEmitter.driverStatus(driver.id, 'Available', tenantId);
  }

  realtimeEmitter.tripCompleted(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Completed',
    message: 'A fleet trip has been completed and its delivery readings were recorded.',
    tenantId,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/cancel', requireRole('fleet_manager'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });
  if (!['Draft', 'Dispatched'].includes(trip.status)) {
    return res.status(400).json({ detail: 'Only draft or dispatched trips can be cancelled.' });
  }

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: { status: 'Cancelled' },
  });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  if (vehicle && vehicle.status === 'On Trip') {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'Available' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available', tenantId);
  }

  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });
  if (driver && driver.status === 'On Trip') {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: { status: 'Available' },
    });
    realtimeEmitter.driverStatus(driver.id, 'Available', tenantId);
  }

  return res.json(updatedTrip);
});
