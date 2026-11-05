/**
 * The status a document route gives when the printer cannot print. Readiness already
 * refuses traffic in that state, so the route only answers the race it lost.
 */

import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/common/errors/app-error';
import {
  DocumentPrintError,
  type DocumentPrinterService,
} from '../../src/documents/print/document-printer.service';
import type { DocumentTemplate } from '../../src/documents/print/document-template';
import { renderForDownload } from '../../src/documents/rendered-document';

const TEMPLATE = { identity: 'Purchase order PO-2026-0001' } as unknown as DocumentTemplate;

function printerThat(action: () => Promise<Uint8Array>): DocumentPrinterService {
  return { printDocument: action } as unknown as DocumentPrinterService;
}

describe('document render failures', () => {
  it('answers a dead renderer with a retryable 503', async () => {
    const response = await renderForDownload(
      printerThat(async () => {
        throw new DocumentPrintError('browserType.launch: Executable does not exist');
      }),
      TEMPLATE,
      null,
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(AppError);
    expect((response as AppError).status).toBe(503);
    expect((response as AppError).code).toBe('renderer_unavailable');
  });

  it('keeps every other failure the failure it was', async () => {
    const thrown = new AppError('sales_invoice_not_found', 'No such invoice.', 404);

    await expect(
      renderForDownload(
        printerThat(async () => {
          throw thrown;
        }),
        TEMPLATE,
        null,
      ),
    ).rejects.toBe(thrown);
  });

  it('hands the template and the mark to the printer unchanged', async () => {
    const logo = { mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) } as const;
    const seen: unknown[] = [];
    const stub = {
      printDocument: async (template: unknown, mark: unknown) => {
        seen.push(template, mark);
        return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      },
    } as unknown as DocumentPrinterService;

    const pdf = await renderForDownload(stub, TEMPLATE, logo);

    expect(seen).toEqual([TEMPLATE, logo]);
    expect([...pdf]).toEqual([0x25, 0x50, 0x44, 0x46]);
  });
});
