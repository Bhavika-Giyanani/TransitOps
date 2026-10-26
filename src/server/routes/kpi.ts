import { Router, Request, Response } from 'express';
import { kpiService } from '../services/kpi';

export const kpiRouter = Router();

kpiRouter.get('/fleet', async (_req: Request, res: Response) => {
  const kpis = await kpiService.getFleetKpis();
  return res.json(kpis);
});

kpiRouter.get('/driver', async (req: Request, res: Response) => {
  const driverId = req.query.driverId as string | undefined;
  const kpis = await kpiService.getDriverKpis('demo_tenant', driverId);
  return res.json(kpis);
});

kpiRouter.get('/safety', async (_req: Request, res: Response) => {
  const kpis = await kpiService.getSafetyKpis();
  return res.json(kpis);
});

kpiRouter.get('/financial', async (_req: Request, res: Response) => {
  const kpis = await kpiService.getFinancialKpis();
  return res.json(kpis);
});
