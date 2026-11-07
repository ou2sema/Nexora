import type { NextFunction, Request, Response } from 'express';

import type { MetricsService } from './metrics.service';

interface RouteInformation {
  path?: string | string[];
}

/**
 * Counting on `finish` (and `close` for aborted calls) is the only place the
 * final status code is known: Nest sets `201` for POST after the handler has
 * returned, so an interceptor would record `200` instead.
 */
export function httpMetricsMiddleware(metrics: MetricsService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const method = request.method;
    const startedAt = process.hrtime.bigint();
    let recorded = false;

    metrics.httpInFlight.inc({ method });

    const record = (): void => {
      if (recorded) {
        return;
      }
      recorded = true;

      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      metrics.observe(method, routeLabel(request), response.statusCode, seconds);
      metrics.httpInFlight.dec({ method });
    };

    response.once('finish', record);
    response.once('close', record);
    next();
  };
}

/**
 * The route pattern (`/catalog/items/:id`) keeps cardinality bounded. The raw
 * path is never used: every product id would otherwise become its own series.
 */
function routeLabel(request: Request): string {
  const route = (request as Request & { route?: RouteInformation }).route;
  const path = route?.path;
  const routePath = Array.isArray(path) ? path[0] : path;

  // Express 5 answers unknown paths through a wildcard route such as
  // `/api/v1*path`; it is bounded, but "unmatched" reads better in a dashboard.
  if (!routePath || routePath.includes('*')) {
    return 'unmatched';
  }

  const base = request.baseUrl ?? '';
  return routePath.startsWith(base) ? routePath : `${base}${routePath}`;
}
