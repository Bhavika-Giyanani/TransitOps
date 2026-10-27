import { Router, Request, Response } from 'express';
import { kpiService } from '../../services/kpi';
import { requireAuth, requireRole } from '../../middleware/auth';
import { findDriverForUser } from '../drivers/driverIdentity';

export const kpiRouter = Router();
kpiRouter.use(requireAuth);

kpiRouter.get('/fleet', requireRole('fleet_manager', 'safety_officer', 'financial_analyst'), async (req: Request, res: Response) => {
  const kpis = await kpiService.getFleetKpis(req.user!.tenantId);
  return res.json(kpis);
});

kpiRouter.get('/driver', async (req: Request, res: Response) => {
  let driverId = req.query.driverId as string | undefined;
  if (req.user!.role === 'driver') {
    const driver = await findDriverForUser(req.user!.id, req.user!.tenantId);
    if (!driver) return res.status(404).json({ detail: 'Driver profile not found.' });
    driverId = driver.id;
  }
  const kpis = await kpiService.getDriverKpis(req.user!.tenantId, driverId);
  return res.json(kpis);
});

kpiRouter.get('/safety', requireRole('fleet_manager', 'safety_officer'), async (req: Request, res: Response) => {
  const kpis = await kpiService.getSafetyKpis(req.user!.tenantId);
  return res.json(kpis);
});

kpiRouter.get('/financial', requireRole('fleet_manager', 'financial_analyst'), async (req: Request, res: Response) => {
  const kpis = await kpiService.getFinancialKpis(req.user!.tenantId);
  return res.json(kpis);
});
