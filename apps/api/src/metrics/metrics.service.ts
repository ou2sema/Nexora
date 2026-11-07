import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Every series this API publishes carries the same prefix, so a Grafana query
 * can select the service without guessing at prom-client's default names.
 */
export const METRICS_PREFIX = 'nexora_';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'HTTP requests handled, by method, route and status code.',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'HTTP request latency in seconds, by method, route and status code.',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpInFlight = new Gauge({
    name: `${METRICS_PREFIX}http_requests_in_flight`,
    help: 'HTTP requests currently being handled.',
    labelNames: ['method'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: METRICS_PREFIX });

    new Gauge({
      name: `${METRICS_PREFIX}build_info`,
      help: 'Build and runtime information, always 1.',
      labelNames: ['service', 'node_version'],
      registers: [this.registry],
    }).set({ service: 'mystock-api', node_version: process.version }, 1);
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, seconds);
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
