/**
 * The print engine ADR-0019 decision 5 calls for: one browser for the whole API, created
 * lazily, one page per document, and a hard timeout that kills and relaunches the browser
 * instead of hanging a route while a customer waits at the counter.
 *
 * `launchServer()` + `connect()` rather than `launch()` because only the server handle
 * exposes `process()`, and a renderer that cannot signal its browser cannot honour its
 * timeout. A killed browser is noticed by the `disconnected` event and by the next
 * render's call being rejected, so recovery is automatic; measured restart-to-render is
 * 468 ms.
 *
 * Chromium's own PDF bytes are byte-identical only within the same second, because
 * `/CreationDate` has second resolution. The post-pass re-stamps the metadata to the
 * render instant with `useObjectStreams: false`: that makes a document deterministic and
 * keeps `/FontFile2`, `/BaseFont` and `/Type /Page` in plain objects, which the byte-level
 * tests and the logo probe read — object streams pack them away and break both.
 */

import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { chromium, type Browser, type BrowserServer } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';

import { renderDocumentHtml, type DocumentTemplate } from './document-template';
import { logoDataUri } from './document-assets';
import type { StoredLogo } from '../../logos/logo.reader';

export interface PrintJob {
  /** A complete HTML document, already carrying its fonts and its mark. */
  html: string;
  /** `/Title` of the artifact: `<document title> <number>`. */
  title: string;
  /** The instant printed in the footer; also pinned into the PDF metadata. */
  createdAt: Date;
}

export interface RendererDescription {
  state: 'idle' | 'ready' | 'unavailable';
  launches: number;
  renders: number;
  failures: number;
  pid: number | null;
  lastError: string | null;
}

/** Generous for a human at a printer, short enough that a wedged renderer cannot hold a route open. */
const RENDER_TIMEOUT_MS = 20_000;
/**
 * A readiness poll has to answer inside the poller's own timeout, and starting a browser
 * was measured at 0.3–0.6 s, so five seconds is the ceiling before the renderer counts as down.
 */
export const RENDERER_PROBE_TIMEOUT_MS = 5_000;
/** An upload is not a document; it must not sit behind a 20-second render budget. */
const LOGO_PROBE_TIMEOUT_MS = 5_000;
/** A busy counter must not fork a renderer per sale; the queue is the guard. */
const MAX_CONCURRENT_RENDERS = 3;

export class DocumentPrintError extends Error {}

/** The bytes reached a working browser and still drew nothing: the image is the problem. */
export class LogoNotRenderableError extends Error {}

class RenderTimeoutError extends DocumentPrintError {}

@Injectable()
export class DocumentPrinterService implements OnApplicationShutdown {
  private readonly logger = new Logger(DocumentPrinterService.name);
  private readonly waiting: (() => void)[] = [];
  private activeRenders = 0;

  private server: BrowserServer | null = null;
  private browser: Browser | null = null;
  private starting: Promise<Browser> | null = null;

  private launches = 0;
  private rendered = 0;
  private failures = 0;
  private lastError: string | null = null;

  async print(job: PrintJob, timeoutMs: number = RENDER_TIMEOUT_MS): Promise<Uint8Array> {
    await this.takeSlot();

    try {
      const bytes = await this.withDeadline(
        this.renderOnce(job),
        timeoutMs,
        'document rendering timed out',
      );
      this.rendered += 1;
      return bytes;
    } catch (error) {
      this.failures += 1;
      this.lastError = describe(error);
      this.logger.error(`document render failed: ${this.lastError}`);
      // A timeout means the process is not answering, so close() cannot be trusted to return.
      if (error instanceof RenderTimeoutError) await this.kill();
      else await this.stop();

      throw new DocumentPrintError(this.lastError, { cause: error });
    } finally {
      this.releaseSlot();
    }
  }

  /** What the document families call: a print model plus the tenant's mark, a PDF back. */
  async printDocument(template: DocumentTemplate, logo: StoredLogo | null): Promise<Uint8Array> {
    return this.print({
      html: await renderDocumentHtml(template, logo),
      title: template.identity,
      createdAt: template.createdAt,
    });
  }

  /**
   * The write barrier ADR-0018 asks for, re-pointed at the engine that prints documents:
   * a file `pdf-lib` accepts is not necessarily a file a browser draws, so the proof is
   * the render. Bytes that fail to decode leave no image XObject in the output. A browser
   * that cannot start is not the tenant's fault, so the caller keeps those two apart.
   */
  async assertLogoRenderable(logo: StoredLogo): Promise<void> {
    const html =
      '<!doctype html><meta charset="utf-8"><title>Nexora logo probe</title>' +
      `<img src="${logoDataUri(logo)}" alt="">`;
    const bytes = await this.print(
      { html, title: 'Nexora logo probe', createdAt: new Date() },
      LOGO_PROBE_TIMEOUT_MS,
    );

    if (!Buffer.from(bytes).includes('/Subtype /Image', 'latin1')) {
      throw new LogoNotRenderableError('the browser reached these bytes and drew no image');
    }
  }

  /**
   * What readiness asks: is a browser reachable right now? A round trip on the live
   * connection is the cheapest check that actually notices a killed process —
   * `isConnected()` still reported `true` after SIGKILL when measured.
   */
  async probe(): Promise<{ ok: boolean; latencyMs: number; error: string | null }> {
    const started = Date.now();

    try {
      const browser = await this.withDeadline(
        this.ensureBrowser(),
        RENDERER_PROBE_TIMEOUT_MS,
        'renderer probe timed out',
      );
      await browser.version();
      return { ok: true, latencyMs: Date.now() - started, error: null };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: describe(error) };
    }
  }

  describe(): RendererDescription {
    return {
      state: this.browser ? 'ready' : this.lastError ? 'unavailable' : 'idle',
      launches: this.launches,
      renders: this.rendered,
      failures: this.failures,
      pid: this.server?.process().pid ?? null,
      lastError: this.lastError,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  private async renderOnce(job: PrintJob): Promise<Uint8Array> {
    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(job.html, { waitUntil: 'load' });
      // Printing before the faces resolve subsets a host font instead of the bundled one.
      await page.evaluate('document.fonts.ready');
      const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return await stampMetadata(bytes, job.title, job.createdAt);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    this.starting ??= this.startBrowser().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  private async startBrowser(): Promise<Browser> {
    this.launches += 1;
    let server: BrowserServer;

    try {
      server = await chromium.launchServer({ headless: true });
    } catch (error) {
      this.lastError = describe(error);
      throw new DocumentPrintError(
        `${this.lastError} — the API needs Chromium to print documents; install it with ` +
          '`npx playwright install --with-deps chromium`',
        { cause: error },
      );
    }

    const browser = await chromium.connect(server.wsEndpoint());
    browser.once('disconnected', () => {
      if (this.browser !== browser) return;
      this.forgetBrowser();
      // The browser is gone from its own side here, so reap the process rather than ask it
      // to close politely: `close()` waits for a handshake that will never come.
      void server.kill().catch(() => undefined);
    });

    this.server = server;
    this.browser = browser;
    this.lastError = null;
    this.logger.log(`document renderer started (pid ${server.process().pid})`);

    return browser;
  }

  private forgetBrowser(): void {
    this.browser = null;
    this.server = null;
  }

  private async stop(): Promise<void> {
    const server = this.server;
    const browser = this.browser;
    this.forgetBrowser();

    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  }

  private async kill(): Promise<void> {
    const server = this.server;
    const browser = this.browser;
    this.forgetBrowser();

    // `server.kill()` is the only teardown that answers for a browser which stopped serving:
    // measured, `close()` on the same process hung past the SIGKILL because it waits on the
    // connection the wedged page owns, while `kill()` returned in 744 ms and freed the request.
    await server?.kill().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }

  private takeSlot(): Promise<void> {
    if (this.activeRenders < MAX_CONCURRENT_RENDERS) {
      this.activeRenders += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.activeRenders += 1;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeRenders -= 1;
    this.waiting.shift()?.();
  }

  private async withDeadline<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RenderTimeoutError(message)), timeoutMs);
    });
    // The race abandons the task, so it needs an owner or a killed render becomes an
    // unhandled rejection and takes the process down behind the customer's request.
    const owned = task.catch((error: unknown) => {
      throw error;
    });

    try {
      return await Promise.race([owned, deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * pdf-lib writes what the document says instead of what the machine clock says, so two
 * renders of the same rows in the same printed minute are the same bytes.
 */
async function stampMetadata(
  bytes: Uint8Array,
  title: string,
  createdAt: Date,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  pdf.setTitle(title);
  pdf.setCreator('Nexora');
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);

  return pdf.save({ useObjectStreams: false });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
