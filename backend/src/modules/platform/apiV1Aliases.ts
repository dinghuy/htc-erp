import type { NextFunction, Request, Response } from 'express';

const API_V1_PASSTHROUGH_PREFIXES = [
  '/api/v1/integrations/erp/outbox',
  '/api/v1/integrations/erp/sync/run',
] as const;

const API_V1_PREFIXES: Array<{ from: string; to: string }> = [
  { from: '/api/v1/auth', to: '/api/auth' },
  { from: '/api/v1/me', to: '/api/me' },
  { from: '/api/v1/projects', to: '/api/projects' },
  { from: '/api/v1/tasks', to: '/api/tasks' },
  { from: '/api/v1/quotations', to: '/api/quotations' },
  { from: '/api/v1/approvals', to: '/api/approval-requests' },
  { from: '/api/v1/sales-orders', to: '/api/sales-orders' },
  { from: '/api/v1/project-procurement-lines', to: '/api/project-procurement-lines' },
  { from: '/api/v1/project-inbound-lines', to: '/api/project-inbound-lines' },
  { from: '/api/v1/project-delivery-lines', to: '/api/project-delivery-lines' },
  { from: '/api/v1/health', to: '/api/health' },
];

function mapApiV1Path(pathname: string) {
  const normalizedPath = pathname === '/' ? '' : pathname;
  const match = API_V1_PREFIXES.find((candidate) => {
    return normalizedPath === candidate.from || normalizedPath.startsWith(`${candidate.from}/`);
  });

  if (!match) {
    return null;
  }

  const suffix = normalizedPath.slice(match.from.length);
  return `${match.to}${suffix}`;
}

export function createApiV1AliasMiddleware(app: { handle: (req: Request, res: Response, next: (error?: unknown) => void) => void }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = new URL(req.url, 'http://crm.local');

    if (API_V1_PASSTHROUGH_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      return next();
    }

    const mappedPath = mapApiV1Path(url.pathname);

    if (!mappedPath) {
      return next();
    }

    const nextUrl = `${mappedPath}${url.search}`;
    const previousUrl = req.url;
    const previousOriginalUrl = req.originalUrl;

    req.url = nextUrl;
    req.originalUrl = nextUrl;

    return app.handle(req, res, (error?: unknown) => {
      req.url = previousUrl;
      req.originalUrl = previousOriginalUrl;
      next(error as never);
    });
  };
}
