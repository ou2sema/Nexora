/**
 * Guard tests for the warm browser ADR-0019 puts behind every document route.
 *
 * These launch a real Chromium: the guards are the point of the engine, and a stub would
 * pass whatever the stub was told to do. Measured costs are a launch per instance at
 * 0.3-0.6 s and a render at ~0.2 s.
 */

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import {
  DocumentPrintError,
  DocumentPrinterService,
  LogoNotRenderableError,
} from '../../src/documents/print/document-printer.service';
import type { StoredLogo } from '../../src/logos/logo.reader';
import { LOGO_PNG } from '../api/logo-image';

const RENDERED_AT = new Date('2026-11-05T10:00:00.000Z');

/**
 * These tests share the machine with 41 other files, and a render is allowed the engine's own
 * 20 seconds, so the Vitest deadline has to sit above that — otherwise the harness cancels the
 * test before the guard under test ever decides anything. Measured alone the file takes ~4 s.
 */
const BROWSER_ALLOWANCE_MS = 120_000;

function job(body: string, title = 'Printer probe') {
  return {
    html: `<!doctype html><meta charset="utf-8"><title>${title}</title>${body}`,
    title,
    createdAt: RENDERED_AT,
  };
}

async function withPrinter<T>(run: (printer: DocumentPrinterService) => Promise<T>): Promise<T> {
  const printer = new DocumentPrinterService();

  try {
    return await run(printer);
  } finally {
    await printer.onApplicationShutdown();
  }
}

describe('document printer', { timeout: BROWSER_ALLOWANCE_MS }, () => {
  it('returns the same bytes for the same job and stamps when it was printed', async () => {
    await withPrinter(async (printer) => {
      const first = Buffer.from(await printer.print(job('<p>Nexora prints this</p>')));
      const second = Buffer.from(await printer.print(job('<p>Nexora prints this</p>')));

      // Two renders in the same printed second are one file, so a customer retry is auditable.
      expect(second.equals(first)).toBe(true);
      expect(first.subarray(0, 5).toString()).toBe('%PDF-');

      const parsed = await PDFDocument.load(first);
      expect(parsed.getTitle()).toBe('Printer probe');
      expect(parsed.getCreator()).toBe('Nexora');
      expect(parsed.getCreationDate()?.getTime()).toBe(RENDERED_AT.getTime());
      expect(parsed.getPageCount()).toBe(1);

      // The face is a real embedded program, and object streams stay off so the byte-level
      // probes in the logo tests can still see it.
      expect(first.toString('latin1')).toContain('/FontFile2');
      expect(first.toString('latin1')).not.toContain('/ObjStm');
    });
  });

  it('kills a browser that stops answering and starts the next one', async () => {
    await withPrinter(async (printer) => {
      // Warm the renderer first. The guard under test is a wedged *render* mid-shift, and on a
      // busy machine a 750 ms deadline can expire while the very first launch is still queued,
      // which would prove nothing about teardown and restart.
      await printer.print(job('<p>warm</p>'));

      // An infinite script never fires `load`, so only the deadline can free the request.
      const started = Date.now();
      await expect(printer.print(job('<script>while (true) {}</script>'), 750)).rejects.toThrow(
        DocumentPrintError,
      );
      const waited = Date.now() - started;

      expect(waited).toBeGreaterThanOrEqual(700);
      // The 20 s the ordinary render is allowed is not what a wedged browser gets to spend.
      expect(waited).toBeLessThan(5000);
      expect(printer.describe()).toMatchObject({ state: 'unavailable', failures: 1, launches: 1 });

      const bytes = await printer.print(job('<p>recovered</p>'));
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
      expect(printer.describe()).toMatchObject({ state: 'ready', launches: 2, renders: 2 });
    });
  });

  it('serves a busy counter from one browser', async () => {
    await withPrinter(async (printer) => {
      const jobs = Array.from({ length: 5 }, (_, index) =>
        printer.print(job(`<p>receipt ${index}</p>`)),
      );

      const printed = await Promise.all(jobs);
      for (const bytes of printed) {
        expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
      }

      // The queue is the guard: five documents, one browser, no per-sale fork.
      expect(printer.describe()).toMatchObject({ launches: 1, renders: 5, failures: 0 });
    });
  });

  it('answers readiness without printing a document', async () => {
    await withPrinter(async (printer) => {
      expect(printer.describe()).toMatchObject({ state: 'idle', pid: null, launches: 0 });

      const probe = await printer.probe();
      expect(probe.ok).toBe(true);
      expect(probe.error).toBeNull();
      expect(probe.latencyMs).toBeLessThan(5000);

      const described = printer.describe();
      expect(described.state).toBe('ready');
      expect(described.launches).toBe(1);
      expect(described.renders).toBe(0);
      expect(described.pid).toBeTypeOf('number');
    });
  });

  it('accepts only a mark the printer actually draws', async () => {
    const png: StoredLogo = { mime: 'image/png', bytes: LOGO_PNG };
    const truncated: StoredLogo = {
      mime: 'image/png',
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    };

    await withPrinter(async (printer) => {
      await expect(printer.assertLogoRenderable(png)).resolves.toBeUndefined();

      // A browser that runs and draws nothing points at these bytes, not at the tenant.
      await expect(printer.assertLogoRenderable(truncated)).rejects.toThrow(LogoNotRenderableError);
    });
  });
});
