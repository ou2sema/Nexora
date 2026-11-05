/**
 * Document strings for the four A4 families. ADR-0019 decision 3: the server-rendered
 * artifact follows the locale of the download request instead of staying English, so every
 * label the models used to hold as a literal lives here. `Record<DocumentLocale, …>` is
 * exhaustive, which makes an untranslated document string a type error rather than a
 * silently English page.
 *
 * Amounts, SKUs, serials and identifiers stay in the ASCII form `document-format.ts`
 * produces: they are the values the ledger holds, they are read back from the database, and
 * the template wraps them in a left-to-right isolate so they stay correct inside Arabic
 * sentences. `TND` is the ISO currency code and is not translated.
 */

import type {
  DocumentLocale,
  PaymentMethod,
  PaymentStatus,
  PurchaseOrderStatus,
  ReturnStatus,
  SalesOrderStatus,
} from '@mystock/contracts';

export type { DocumentLocale };

/** The document models are keyed by status; a purchase return and a sales return share the wire enum. */
export type PurchaseReturnStatus = ReturnStatus;

export type { PaymentMethod, PaymentStatus, PurchaseOrderStatus, SalesOrderStatus };

/** Enum keys fall back to the stored value, so an unknown status still prints. */
export function pickLabel<K extends string>(labels: Record<K, string>, key: string): string {
  return labels[key as K] ?? key;
}

export interface DocumentStrings {
  locale: DocumentLocale;
  direction: 'ltr' | 'rtl';
  /** The line under the organization name, and the watermark words. */
  platformSubtitle: string;
  watermarks: { draft: string; cancelled: string };
  titles: Record<'purchaseOrder' | 'purchaseReturnNote' | 'invoice' | 'goodsIssueNote', string>;
  statuses: {
    purchaseOrder: Record<PurchaseOrderStatus, string>;
    purchaseReturn: Record<PurchaseReturnStatus, string>;
    payment: Record<PaymentStatus, string>;
    salesOrder: Record<SalesOrderStatus, string>;
    paymentMethod: Record<PaymentMethod, string>;
  };
  parties: Record<'supplier' | 'shipTo' | 'billTo' | 'depot', string>;
  partyFields: { contact: string; taxId: string };
  meta: Record<
    | 'orderDate'
    | 'expected'
    | 'reference'
    | 'returnDate'
    | 'sourceOrder'
    | 'issueDate'
    | 'exitDocument'
    | 'soldBy'
    | 'invoice'
    | 'releasedBy',
    string
  >;
  columns: Record<
    | 'index'
    | 'sku'
    | 'description'
    | 'quantity'
    | 'unitCost'
    | 'unitPrice'
    | 'tax'
    | 'amount'
    | 'serial',
    string
  >;
  totals: Record<
    | 'lines'
    | 'totalQuantity'
    | 'totalValue'
    | 'totalExclTax'
    | 'tax'
    | 'totalInclTax'
    | 'paid'
    | 'remaining'
    | 'paymentMethod',
    string
  >;
  notes: { title: string; returnReason: string };
  blocks: { paymentsReceived: string; serialNumbers: string };
  emptyTable: string;
  instructions: {
    /** Names the purchase order number inside the delivery instruction. */
    deliverTo: string;
    goodsLeaveFrom: string;
    issueNoteStandard: (invoiceNumber: string) => string;
  };
  /** Arabic counts three grammatical numbers; the caption needs the right one. */
  missingCostCaption: (count: number) => string;
  /** Fragments for the CSS page counter: `<before> n <between> total`. */
  pageLabel: { before: string; between: string };
  generatedOn: (timestamp: string) => string;
}

const english: DocumentStrings = {
  locale: 'en',
  direction: 'ltr',
  platformSubtitle: 'Nexora inventory platform',
  watermarks: { draft: 'DRAFT', cancelled: 'CANCELLED' },
  titles: {
    purchaseOrder: 'Purchase order',
    purchaseReturnNote: 'Purchase return note',
    invoice: 'Invoice',
    goodsIssueNote: 'Goods issue note',
  },
  statuses: {
    purchaseOrder: {
      draft: 'Draft',
      ordered: 'Ordered',
      partially_received: 'Partially received',
      received: 'Received',
      cancelled: 'Cancelled',
    },
    purchaseReturn: { draft: 'Draft', posted: 'Posted', cancelled: 'Cancelled' },
    payment: { unpaid: 'Unpaid', partial: 'Partially paid', paid: 'Paid' },
    salesOrder: {
      draft: 'Draft',
      confirmed: 'Reserved',
      fulfilled: 'Issued',
      cancelled: 'Cancelled',
    },
    paymentMethod: {
      cash: 'Cash',
      bank_transfer: 'Bank transfer',
      card_manual: 'Card (manual entry)',
      credit: 'On account',
    },
  },
  parties: { supplier: 'Supplier', shipTo: 'Ship to', billTo: 'Bill to', depot: 'Depot' },
  partyFields: { contact: 'Contact', taxId: 'Tax ID' },
  meta: {
    orderDate: 'Order date',
    expected: 'Expected',
    reference: 'Reference',
    returnDate: 'Return date',
    sourceOrder: 'Source order',
    issueDate: 'Issue date',
    exitDocument: 'Exit document',
    soldBy: 'Sold by',
    invoice: 'Invoice',
    releasedBy: 'Released by',
  },
  columns: {
    index: '#',
    sku: 'SKU',
    description: 'Description',
    quantity: 'Qty',
    unitCost: 'Unit cost',
    unitPrice: 'Unit price',
    tax: 'Tax',
    amount: 'Amount',
    serial: 'Serial / IMEI',
  },
  totals: {
    lines: 'Lines',
    totalQuantity: 'Total quantity',
    totalValue: 'Total value',
    totalExclTax: 'Total excl. tax',
    tax: 'Tax',
    totalInclTax: 'Total incl. tax',
    paid: 'Paid',
    remaining: 'Remaining',
    paymentMethod: 'Payment method',
  },
  notes: { title: 'Notes', returnReason: 'Return reason' },
  blocks: { paymentsReceived: 'Payments received', serialNumbers: 'Serial numbers' },
  emptyTable: 'No lines on this document.',
  instructions: {
    deliverTo: 'Deliver to this location. Quote the purchase order number on all documents.',
    goodsLeaveFrom: 'Goods leave this location. Quote the invoice number on all documents.',
    issueNoteStandard: (invoiceNumber: string) =>
      `Every quantity on this note has left the depot. This note is not a tax document: invoice ${invoiceNumber} carries the amounts.`,
  },
  missingCostCaption: (count: number) =>
    count === 1
      ? '1 line has no unit cost and is excluded from the total.'
      : `${count} lines have no unit cost and are excluded from the total.`,
  pageLabel: { before: 'Page ', between: ' of ' },
  generatedOn: (timestamp: string) => `Generated by Nexora on ${timestamp} UTC`,
};

const french: DocumentStrings = {
  locale: 'fr',
  direction: 'ltr',
  platformSubtitle: 'Plateforme de gestion des stocks Nexora',
  watermarks: { draft: 'BROUILLON', cancelled: 'ANNULÉ' },
  titles: {
    purchaseOrder: 'Bon de commande',
    purchaseReturnNote: 'Bon de retour fournisseur',
    invoice: 'Facture',
    goodsIssueNote: 'Bon de sortie',
  },
  statuses: {
    purchaseOrder: {
      draft: 'Brouillon',
      ordered: 'Commandé',
      partially_received: 'Partiellement reçu',
      received: 'Reçu',
      cancelled: 'Annulé',
    },
    purchaseReturn: { draft: 'Brouillon', posted: 'Comptabilisé', cancelled: 'Annulé' },
    payment: { unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée' },
    salesOrder: {
      draft: 'Brouillon',
      confirmed: 'Réservé',
      fulfilled: 'Livré',
      cancelled: 'Annulé',
    },
    paymentMethod: {
      cash: 'Espèces',
      bank_transfer: 'Virement bancaire',
      card_manual: 'Carte (saisie manuelle)',
      credit: 'Sur compte',
    },
  },
  parties: { supplier: 'Fournisseur', shipTo: 'Livrer à', billTo: 'Facturer à', depot: 'Dépôt' },
  partyFields: { contact: 'Contact', taxId: 'Identifiant fiscal' },
  meta: {
    orderDate: 'Date de commande',
    expected: 'Livraison prévue',
    reference: 'Référence',
    returnDate: 'Date de retour',
    sourceOrder: 'Commande source',
    issueDate: "Date d'émission",
    exitDocument: 'Document de sortie',
    soldBy: 'Vendu par',
    invoice: 'Facture',
    releasedBy: 'Libéré par',
  },
  columns: {
    index: 'N°',
    sku: 'Code article',
    description: 'Désignation',
    quantity: 'Quantité',
    unitCost: 'Coût unitaire',
    unitPrice: 'Prix unitaire',
    tax: 'TVA',
    amount: 'Montant',
    serial: 'N° de série / IMEI',
  },
  totals: {
    lines: 'Lignes',
    totalQuantity: 'Quantité totale',
    totalValue: 'Valeur totale',
    totalExclTax: 'Total HT',
    tax: 'TVA',
    totalInclTax: 'Total TTC',
    paid: 'Payé',
    remaining: 'Restant',
    paymentMethod: 'Mode de paiement',
  },
  notes: { title: 'Notes', returnReason: 'Motif du retour' },
  blocks: { paymentsReceived: 'Paiements reçus', serialNumbers: 'Numéros de série' },
  emptyTable: 'Aucune ligne sur ce document.',
  instructions: {
    deliverTo: 'Livrer à ce lieu. Indiquez le numéro du bon de commande sur tous les documents.',
    goodsLeaveFrom:
      'La marchandise quitte ce lieu. Indiquez le numéro de la facture sur tous les documents.',
    issueNoteStandard: (invoiceNumber: string) =>
      `Toutes les quantités de ce bon sont sorties du dépôt. Ce bon n'est pas un document fiscal : la facture ${invoiceNumber} porte les montants.`,
  },
  missingCostCaption: (count: number) =>
    count > 1
      ? `${count} lignes n'ont pas de coût unitaire et sont exclues du total.`
      : `${count} ligne n'a pas de coût unitaire et est exclue du total.`,
  pageLabel: { before: 'Page ', between: ' sur ' },
  generatedOn: (timestamp: string) => `Généré par Nexora le ${timestamp} UTC`,
};

const arabic: DocumentStrings = {
  locale: 'ar',
  direction: 'rtl',
  platformSubtitle: 'منصة نكسورا لإدارة المخزون',
  watermarks: { draft: 'مسودة', cancelled: 'ملغى' },
  titles: {
    purchaseOrder: 'أمر شراء',
    purchaseReturnNote: 'إشعار إرجاع مشتريات',
    invoice: 'فاتورة',
    goodsIssueNote: 'سند خروج البضاعة',
  },
  statuses: {
    purchaseOrder: {
      draft: 'مسودة',
      ordered: 'مطلوب',
      partially_received: 'مستلم جزئيا',
      received: 'مستلم',
      cancelled: 'ملغى',
    },
    purchaseReturn: { draft: 'مسودة', posted: 'مرحّل', cancelled: 'ملغى' },
    payment: { unpaid: 'غير مدفوعة', partial: 'مدفوعة جزئيا', paid: 'مدفوعة' },
    salesOrder: {
      draft: 'مسودة',
      confirmed: 'محجوز',
      fulfilled: 'مُسلَّم',
      cancelled: 'ملغى',
    },
    paymentMethod: {
      cash: 'نقدا',
      bank_transfer: 'تحويل بنكي',
      card_manual: 'بطاقة (إدخال يدوي)',
      credit: 'على الحساب',
    },
  },
  parties: {
    supplier: 'المورد',
    shipTo: 'يُسلَّم إلى',
    billTo: 'الفاتورة باسم',
    depot: 'المستودع',
  },
  partyFields: { contact: 'جهة الاتصال', taxId: 'المعرف الجبائي' },
  meta: {
    orderDate: 'تاريخ الطلب',
    expected: 'الوصول المتوقع',
    reference: 'المرجع',
    returnDate: 'تاريخ الإرجاع',
    sourceOrder: 'أمر الشراء الأصلي',
    issueDate: 'تاريخ الإصدار',
    exitDocument: 'سند الخروج',
    soldBy: 'البائع',
    invoice: 'الفاتورة',
    releasedBy: 'أخرجه',
  },
  columns: {
    index: 'ر.',
    sku: 'رمز المنتج',
    description: 'الوصف',
    quantity: 'الكمية',
    unitCost: 'كلفة الوحدة',
    unitPrice: 'سعر الوحدة',
    tax: 'الضريبة',
    amount: 'المبلغ',
    serial: 'الرقم التسلسلي / IMEI',
  },
  totals: {
    lines: 'عدد الأسطر',
    totalQuantity: 'مجموع الكميات',
    totalValue: 'القيمة الجملية',
    totalExclTax: 'المجموع دون الضريبة',
    tax: 'الضريبة',
    totalInclTax: 'المجموع مع الضريبة',
    paid: 'المدفوع',
    remaining: 'المتبقي',
    paymentMethod: 'طريقة الدفع',
  },
  notes: { title: 'ملاحظات', returnReason: 'سبب الإرجاع' },
  blocks: { paymentsReceived: 'المدفوعات المستلمة', serialNumbers: 'الأرقام التسلسلية' },
  emptyTable: 'لا توجد أسطر في هذا المستند.',
  instructions: {
    deliverTo: 'يُسلَّم إلى هذا الموقع. يُرجى ذكر رقم أمر الشراء في جميع المستندات.',
    goodsLeaveFrom: 'تخرج البضاعة من هذا الموقع. يُرجى ذكر رقم الفاتورة في جميع المستندات.',
    issueNoteStandard: (invoiceNumber: string) =>
      `كل الكميات الواردة في هذا السند قد خرجت من المستودع. هذا السند ليس مستندا جبائيا: الفاتورة ${invoiceNumber} هي التي تحمل المبالغ.`,
  },
  missingCostCaption: (count: number) => {
    if (count === 1) return 'سطر واحد لا يحتوي على كلفة وحدة وهو مستثنى من المجموع.';
    if (count === 2) return 'سطران لا يحتويان على كلفة وحدة وهما مستثنيان من المجموع.';
    if (count >= 3 && count <= 10) {
      return `${count} أسطر لا تحتوي على كلفة وحدة وهي مستثناة من المجموع.`;
    }
    return `${count} سطرا لا يحتوي على كلفة الوحدة وهو مستثنى من المجموع.`;
  },
  pageLabel: { before: 'صفحة ', between: ' من ' },
  generatedOn: (timestamp: string) => `أُنشئ بواسطة نكسورا في ${timestamp} UTC`,
};

export const DOCUMENT_STRINGS: Record<DocumentLocale, DocumentStrings> = {
  en: english,
  fr: french,
  ar: arabic,
};

export function documentStrings(locale: DocumentLocale): DocumentStrings {
  return DOCUMENT_STRINGS[locale];
}
