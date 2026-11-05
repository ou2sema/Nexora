import { Module } from '@nestjs/common';

import { DocumentPrinterService } from './document-printer.service';

/**
 * The API owns one browser now (ADR-0019 decision 5), so the renderer is a module of its
 * own: the document services print through it, the logo probe asks it whether an image
 * will actually draw, and readiness asks it whether it is alive at all.
 */
@Module({ providers: [DocumentPrinterService], exports: [DocumentPrinterService] })
export class DocumentPrintModule {}
