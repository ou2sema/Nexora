import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import bwipjs from 'bwip-js';
import {
  type PDFFont,
  type PDFImage,
  type PDFPage,
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { sql } from 'drizzle-orm';

import type { LabelRequest } from '@mystock/contracts';
import { isValidGtinBarcode } from '@mystock/domain';

import { AppError } from '../common/errors/app-error';
import type { AppTransaction } from '../database/database.types';
import { products } from '../database/schema';
import { resultRows } from '../database/results';
import { sanitizeText } from '../documents/document-format';
import { embedLogoImage } from '../logos/logo.embed';
import { type StoredLogo, readStoredLogo } from '../logos/logo.reader';
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

interface TrackedItemLabelRow {
  id: string;
  unit_code: string;
  serial_number: string | null;
  product_name: string;
  product_sku: string;
}

interface LabelSpec {
  title: string;
  subtitle: string;
  code: string;
}

interface OrganizationRow {
  name: string;
}

interface OrganizationIdentity {
  name: string;
  logo: StoredLogo | null;
}

const PAGE_MARGIN_X = 28;
const PAGE_MARGIN_Y = 22;
const GRID_COLUMNS = 3;
const GRID_ROWS = 8;
const CELL_HEIGHT = 100;

const BARCODE_MAX_HEIGHT = 44;
// The human-readable code sits under the bars, centred on them and spread to their width,
// the way a retail label reads: bars and number are one block, not two lines of text.
const CODE_MIN_SIZE = 8;
const CODE_MAX_SIZE = 11;
const CODE_WIDTH_SHARE = 0.94;
const CODE_HEIGHT_SHARE = 0.3;

// Eight 100 pt rows start 22 pt from the top, so the only free paper on an A4 sheet is
// the bottom margin. Branding goes there: the grid itself never moves, because these
// sheets are printed on pre-cut label stock.
const FOOTER_BASELINE = 18;
const FOOTER_LOGO_MAX_WIDTH = 14;
const FOOTER_LOGO_MAX_HEIGHT = 10;
const FOOTER_LOGO_GAP = 6;
const FOOTER_MUTED = rgb(0.35, 0.4, 0.48);

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

function codeSize(
  font: PDFFont,
  code: string,
  barcodeWidth: number,
  barcodeHeight: number,
): number {
  const widthAtOne = font.widthOfTextAtSize(code, 1);
  if (widthAtOne <= 0) return CODE_MIN_SIZE;
  const ideal = Math.min(
    (barcodeWidth * CODE_WIDTH_SHARE) / widthAtOne,
    barcodeHeight * CODE_HEIGHT_SHARE,
  );
  return Math.min(CODE_MAX_SIZE, Math.max(CODE_MIN_SIZE, Math.round(ideal * 2) / 2));
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
      const itemIds = [
        ...new Set(input.items.flatMap((item) => (item.kind === 'item' ? [item.itemId] : []))),
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

      const itemRows = itemIds.length
        ? resultRows<TrackedItemLabelRow>(
            await tx.execute(sql`
              select t.id, t.unit_code, t.serial_number,
                     p.name as product_name, p.sku as product_sku
              from public.tracked_items t
              join public.products p
                on p.id = t.product_id and p.organization_id = t.organization_id
              where t.organization_id = ${organizationId}
                and t.id in (${sql.join(
                  itemIds.map((id) => sql`${id}::uuid`),
                  sql`, `,
                )})
            `),
          )
        : [];

      const itemById = new Map(itemRows.map((row) => [row.id, row]));

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

        if (item.kind === 'device') {
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
          continue;
        }

        const tracked = itemById.get(item.itemId);
        if (!tracked) {
          throw new AppError('tracked_item_not_found', 'Tracked item not found.', 404);
        }
        const subtitle = tracked.serial_number
          ? `SKU ${tracked.product_sku} · SN ${tracked.serial_number}`
          : `SKU ${tracked.product_sku}`;
        for (let copy = 0; copy < copies; copy += 1) {
          labels.push({ title: tracked.product_name, subtitle, code: tracked.unit_code });
        }
      }

      return this.buildPdf(labels, await this.organizationIdentity(tx, organizationId));
    });
  }

  private async organizationIdentity(
    tx: AppTransaction,
    organizationId: string,
  ): Promise<OrganizationIdentity> {
    const rows = resultRows<OrganizationRow>(
      await tx.execute(sql`
        select name from public.organizations where id = ${organizationId}
      `),
    );

    return { name: rows[0]?.name ?? '', logo: await readStoredLogo(tx, organizationId) };
  }

  private async buildPdf(labels: LabelSpec[], identity: OrganizationIdentity): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    // pdf-lib overwrites /Producer with its own signature on every save, so /Creator is the
    // only metadata field that can carry the product name.
    document.setTitle(sanitizeText(identity.name ? `${identity.name} labels` : 'Nexora labels'));
    document.setCreator('Nexora');

    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const logoImage = identity.logo ? await embedLogoImage(document, identity.logo) : null;

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
        const scale = Math.min((cellWidth - 20) / image.width, BARCODE_MAX_HEIGHT / image.height);
        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;
        const imageX = left + (cellWidth - imageWidth) / 2;
        const imageY = top - 26 - imageHeight;

        page.drawImage(image, {
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight,
        });

        const size = codeSize(regular, label.code, imageWidth, imageHeight);
        const printed = fitText(regular, size, label.code, imageWidth);
        const textWidth = regular.widthOfTextAtSize(printed, size);
        page.drawText(printed, {
          x: imageX + (imageWidth - textWidth) / 2,
          y: imageY - size * 0.8,
          size,
          font: regular,
          color: rgb(0.08, 0.1, 0.15),
        });
      }
    }

    for (const page of document.getPages()) {
      drawIdentityFooter(page, regular, identity.name, logoImage);
    }

    return document.save();
  }
}

/**
 * The bottom margin is the only free paper on a pre-cut sheet, so the tenant's identity
 * line sits there and the 3x8 grid never moves.
 */
function drawIdentityFooter(
  page: PDFPage,
  font: PDFFont,
  name: string,
  logo: PDFImage | null,
): void {
  const visibleName = sanitizeText(name);
  const { width: pageWidth } = page.getSize();
  let x = PAGE_MARGIN_X;

  if (logo) {
    const scale = Math.min(
      FOOTER_LOGO_MAX_WIDTH / logo.width,
      FOOTER_LOGO_MAX_HEIGHT / logo.height,
    );
    const width = logo.width * scale;
    const height = logo.height * scale;
    page.drawImage(logo, {
      x,
      y: FOOTER_BASELINE + 2.5 - height / 2,
      width,
      height,
    });
    x += width + FOOTER_LOGO_GAP;
  }

  if (!visibleName) return;

  page.drawText(fitText(font, 7, visibleName, pageWidth - PAGE_MARGIN_X - x), {
    x,
    y: FOOTER_BASELINE,
    size: 7,
    font,
    color: FOOTER_MUTED,
  });
}
