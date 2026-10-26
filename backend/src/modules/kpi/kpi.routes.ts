import { Router, Request, Response } from 'express';
import { kpiService } from '../../services/kpi';
import { requireAuth } from '../../middleware/auth';

export const kpiRouter = Router();
kpiRouter.use(requireAuth);

kpiRouter.get('/fleet', async (req: Request, res: Response) => {
  const kpis = await kpiService.getFleetKpis(req.user!.tenantId);
  return res.json(kpis);
});

kpiRouter.get('/driver', async (req: Request, res: Response) => {
  const driverId = req.query.driverId as string | undefined;
  const kpis = await kpiService.getDriverKpis(req.user!.tenantId, driverId);
  return res.json(kpis);
});

kpiRouter.get('/safety', async (req: Request, res: Response) => {
  const kpis = await kpiService.getSafetyKpis(req.user!.tenantId);
  return res.json(kpis);
});

kpiRouter.get('/financial', async (req: Request, res: Response) => {
  const kpis = await kpiService.getFinancialKpis(req.user!.tenantId);
  return res.json(kpis);
});
