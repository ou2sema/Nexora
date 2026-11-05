import { AppError } from '../common/errors/app-error';
import type { StoredLogo } from '../logos/logo.reader';
import { DocumentPrintError, type DocumentPrinterService } from './print/document-printer.service';
import type { DocumentTemplate } from './print/document-template';

/** A PDF the API renders and streams to the browser as a download. */
export interface RenderedDocument {
  pdf: Uint8Array;
  fileName: string;
}

/**
 * The route-level meaning of a print. A render fails because the browser the API owns died,
 * refused to start, or ran out of its deadline — none of which the tenant caused and all of
 * which a retry can fix — so it answers 503 with a code the interface can explain instead of
 * a bare 500 that reads as a broken document.
 */
export async function renderForDownload(
  printer: DocumentPrinterService,
  template: DocumentTemplate,
  logo: StoredLogo | null,
): Promise<Uint8Array> {
  try {
    return await printer.printDocument(template, logo);
  } catch (error) {
    if (error instanceof DocumentPrintError) {
      throw new AppError(
        'renderer_unavailable',
        'Documents cannot be printed right now. Try again in a moment.',
        503,
      );
    }

    throw error;
  }
}
