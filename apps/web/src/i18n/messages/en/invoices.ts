export const invoices = {
  'invoice.paymentStatus.unpaid': 'Unpaid',
  'invoice.paymentStatus.partial': 'Partially paid',
  'invoice.paymentStatus.paid': 'Paid',

  'invoice.method.cash': 'Cash',
  'invoice.method.bank_transfer': 'Bank transfer',
  'invoice.method.card_manual': 'Card (keyed by hand)',
  'invoice.method.credit': 'Credit / on account',

  'invoice.detail.title': 'Invoice',
  'invoice.detail.subtitle': 'Loading the invoice…',
  'invoice.detail.loading': 'Loading the invoice…',
  'invoice.detail.loadFailed': 'The invoice could not be loaded.',
  'invoice.detail.issuedOn': 'Issued on {when}',
  'invoice.detail.viewerReadOnly':
    'Your viewer role is read-only. Payments are recorded by an owner, admin or manager.',

  'invoice.detail.customer': 'Customer',
  'invoice.detail.depot': 'Depot',
  'invoice.detail.issued': 'Issued',
  'invoice.detail.volume': 'Volume',
  'invoice.detail.lineQuantity': '{lines} lines / {quantity} units',
  'invoice.detail.status': 'Payment',
  'invoice.detail.net': 'Net (HT)',
  'invoice.detail.tax': 'Tax',
  'invoice.detail.total': 'Gross (TTC)',
  'invoice.detail.paid': 'Received',
  'invoice.detail.remaining': 'Still due',

  'invoice.detail.linesCaption': 'Invoice lines',
  'invoice.detail.columns.item': 'Item',
  'invoice.detail.columns.unitPrice': 'Unit price',
  'invoice.detail.columns.taxRate': 'Tax %',
  'invoice.detail.columns.total': 'Total',

  'invoice.detail.payments.title': 'Payments recorded',
  'invoice.detail.payments.empty': 'No payment recorded against this invoice.',

  'invoice.detail.payment.heading': 'Record a payment',
  'invoice.detail.payment.dueNow': '{remaining} is still due on this invoice.',
  'invoice.detail.payment.amount': 'Amount',
  'invoice.detail.payment.method': 'Method',
  'invoice.detail.payment.note': 'Note',
  'invoice.detail.payment.submit': 'Record payment',
  'invoice.detail.payment.invalid': 'Enter an amount in millimes.',
  'invoice.detail.payment.exceedsRemaining': 'The payment is larger than the amount still due.',
  'invoice.detail.payment.settlesInvoice': 'This settles the invoice exactly.',
  'invoice.detail.payment.failed': 'The payment could not be recorded.',
  'invoice.detail.payment.recorded': 'Payment recorded on {number}; {remaining} still due.',
  'invoice.detail.payment.fullyPaid': '{number} is paid in full.',

  'invoice.detail.docs': 'Documents',
  'invoice.detail.docsHint':
    'Both are rendered from the stored invoice, so the copy the customer keeps and the copy the depot keeps cannot disagree.',
  'invoice.detail.downloadInvoice': 'Invoice PDF',
  'invoice.detail.downloadIssueNote': 'Bon de sortie PDF',
  'invoice.detail.downloaded': '{filename} saved.',
  'invoice.detail.pdfFailed': 'The document could not be downloaded.',
} as const;

export type InvoiceMessages = Record<keyof typeof invoices, string>;
