import type { Express, Request, Response } from 'express';

type AsyncRouteFactory = (handler: (req: Request, res: Response) => Promise<unknown>) => any;

type RegisterExchangeRateRoutesDeps = {
  ah: AsyncRouteFactory;
  parseExchangeRatePair: (pairRaw: unknown) => { baseCurrency: string; quoteCurrency: string } | null;
  getLatestExchangeRatePayload: (baseCurrency: string, quoteCurrency: string) => Promise<unknown>;
  refreshVcbRates: () => Promise<{ payload: unknown; lastKnownRateDate: string | null }>;
};

export function registerExchangeRateRoutes(app: Express, deps: RegisterExchangeRateRoutesDeps) {
  const {
    ah,
    parseExchangeRatePair,
    getLatestExchangeRatePayload,
    refreshVcbRates,
  } = deps;

  app.get('/api/exchange-rates/latest', ah(async (req: Request, res: Response) => {
    const pair = parseExchangeRatePair(req.query.pair);
    if (!pair) {
      return res.status(400).json({ error: 'Invalid pair. Expected six alphabetic characters like USDVND.' });
    }

    const payload = await getLatestExchangeRatePayload(pair.baseCurrency, pair.quoteCurrency);
    res.json(payload);
  }));

  app.post('/api/exchange-rates/refresh', ah(async (_req: Request, res: Response) => {
    try {
      const result = await refreshVcbRates();
      res.json(result.payload);
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 502;
      res.status(status).json({
        error: err?.message || 'VCB refresh failed',
        lastKnownRateDate: err?.lastKnownRateDate ?? null,
      });
    }
  }));
}
