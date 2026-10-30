import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import bwipjs from 'bwip-js';
import { type PDFFont, PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sql } from 'drizzle-orm';

import type { LabelRequest } from '@mystock/contracts';
import { isValidGtinBarcode } from '@mystock/domain';

import { AppError } from '../common/errors/app-error';
import { products } from '../database/schema';
import { resultRows } from '../database/results';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TenantAccessService } from '../tenancy/tenant-access.service';

interface DeviceLabelRow {
  id: string;
  serial_number: string;
  imei: string | null;
  product_name: string;
  product_sku: string;
}

interface LabelSpec {
  title: string;
  subtitle: string;
  code: string;
}

const PAGE_MARGIN_X = 28;
const PAGE_MARGIN_Y = 22;
const GRID_COLUMNS = 3;
const GRID_ROWS = 8;
const CELL_HEIGHT = 100;

/** EAN/UPC symbologies are selected by GTIN length; anything else is Code 128. */
function symbologyFor(code: string): string {
  if (!isValidGtinBarcode(code)) return 'code128';
  switch (code.length) {
    case 8:
      return 'ean8';
    case 12:
      return 'upca';
    case 13:
      return 'ean13';
    case 14:
      return 'itf14';
    default:
      return 'code128';
  }
}

async function renderBarcode(code: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: symbologyFor(code),
    text: code,
    scale: 3,
    height: 12,
    includetext: false,
    paddingwidth: 4,
    paddingheight: 4,
    backgroundcolor: 'FFFFFF',
  });
}

function fitText(font: PDFFont, size: number, text: string, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

@Injectable()
export class LabelsService {
  constructor(private readonly access: TenantAccessService) {}

  async render(userId: string, organizationId: string, input: LabelRequest): Promise<Uint8Array> {
    return this.access.runAsMember(userId, organizationId, async (tx) => {
      const productIds = [
        ...new Set(
          input.items.flatMap((item) => (item.kind === 'product' ? [item.productId] : [])),
        ),
      ];
      const deviceIds = [
        ...new Set(input.items.flatMap((item) => (item.kind === 'device' ? [item.deviceId] : []))),
      ];

      const productRows = productIds.length
        ? await tx
            .select({
              id: products.id,
              name: products.name,
              sku: products.sku,
              barcode: products.barcode,
              internalCode: products.internalCode,
            })
            .from(products)
            .where(
              and(eq(products.organizationId, organizationId), inArray(products.id, productIds)),
            )
        : [];

      const deviceRows = deviceIds.length
        ? resultRows<DeviceLabelRow>(
            await tx.execute(sql`
              select d.id, d.serial_number, d.imei,
                     p.name as product_name, p.sku as product_sku
              from public.devices d
              join public.products p
                on p.id = d.product_id and p.organization_id = d.organization_id
              where d.organization_id = ${organizationId}
                and d.id in (${sql.join(
                  deviceIds.map((id) => sql`${id}::uuid`),
                  sql`, `,
                )})
            `),
          )
        : [];

      const productById = new Map(productRows.map((row) => [row.id, row]));
      const deviceById = new Map(deviceRows.map((row) => [row.id, row]));

      const labels: LabelSpec[] = [];
      for (const item of input.items) {
        const copies = item.copies ?? 1;

        if (item.kind === 'product') {
          const product = productById.get(item.productId);
          if (!product) {
            throw new AppError('product_not_found', 'Product not found.', 404);
          }
          const code = product.barcode ?? product.internalCode ?? product.sku;
          for (let copy = 0; copy < copies; copy += 1) {
            labels.push({ title: product.name, subtitle: `SKU ${product.sku}`, code });
          }
          continue;
        }

        const device = deviceById.get(item.deviceId);
        if (!device) {
          throw new AppError('device_not_found', 'Device not found.', 404);
        }
        const subtitle = device.imei
          ? `SKU ${device.product_sku} · IMEI ${device.imei}`
          : `SKU ${device.product_sku}`;
        for (let copy = 0; copy < copies; copy += 1) {
          labels.push({ title: device.product_name, subtitle, code: device.serial_number });
        }
      }

      return this.buildPdf(labels);
    });
  }

  private async buildPdf(labels: LabelSpec[]): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    document.setTitle('MyStock labels');
    document.setProducer('MyStock');
    document.setCreator('MyStock');

    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const mono = await document.embedFont(StandardFonts.Courier);

    const barcodeCache = new Map<string, Awaited<ReturnType<typeof document.embedPng>>>();
    for (const label of labels) {
      if (!barcodeCache.has(label.code)) {
        const png = await renderBarcode(label.code);
        barcodeCache.set(label.code, await document.embedPng(png));
      }
    }

    const firstPage = document.addPage([595.28, 841.89]);
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();
    const cellWidth = (pageWidth - PAGE_MARGIN_X * 2) / GRID_COLUMNS;
    const perPage = GRID_COLUMNS * GRID_ROWS;

    for (let index = 0; index < labels.length; index += 1) {
      const slot = index % perPage;
      const page =
        slot === 0
          ? index === 0
            ? firstPage
            : document.addPage([595.28, 841.89])
          : document.getPage(document.getPageCount() - 1);

      const label = labels[index];
      if (!label) continue;

      const column = slot % GRID_COLUMNS;
      const row = Math.floor(slot / GRID_COLUMNS);
      const left = PAGE_MARGIN_X + column * cellWidth;
      const top = pageHeight - PAGE_MARGIN_Y - row * CELL_HEIGHT;
      const maxTextWidth = cellWidth - 16;

      page.drawText(fitText(bold, 8, label.title, maxTextWidth), {
        x: left + 8,
        y: top - 13,
        size: 8,
        font: bold,
        color: rgb(0.08, 0.1, 0.15),
      });

      page.drawText(fitText(regular, 6.5, label.subtitle, maxTextWidth), {
        x: left + 8,
        y: top - 23,
        size: 6.5,
        font: regular,
        color: rgb(0.35, 0.4, 0.48),
      });

      const image = barcodeCache.get(label.code);
      if (image) {
        const maxImageWidth = cellWidth - 20;
        const maxImageHeight = 44;
        const scale = Math.min(maxImageWidth / image.width, maxImageHeight / image.height);
        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;
        page.drawImage(image, {
          x: left + (cellWidth - imageWidth) / 2,
          y: top - 26 - imageHeight,
          width: imageWidth,
          height: imageHeight,
        });
        page.drawText(fitText(mono, 8, label.code, maxTextWidth), {
          x: left + 8,
          y: top - 78,
          size: 8,
          font: mono,
          color: rgb(0.08, 0.1, 0.15),
        });
      }
    }

    return document.save();
  }
}
