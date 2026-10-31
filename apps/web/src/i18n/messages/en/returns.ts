export const returns = {
  'returns.status.draft': 'Draft',
  'returns.status.posted': 'Posted',
  'returns.status.cancelled': 'Cancelled',
  'returns.loadFailed': 'Returns failed to load.',
  'returns.empty': 'No returns recorded for this order.',
  'returns.columns.number': 'Number',
  'returns.postAction': 'Post return',
  'returns.cancelAction': 'Cancel return',
  'returns.preparing': 'Preparing…',
  'returns.downloadPdf': 'Download PDF',
  'returns.downloaded': 'Downloaded {filename}',
  'returns.downloadFailed': 'The return note could not be generated.',
  'returns.postFailed': 'The return could not be posted.',
  'returns.cancelFailed': 'The return could not be cancelled.',
  'returns.cancelled': 'Return {number} cancelled.',
  'returns.createFailed': 'The return could not be created.',

  'returns.form.referenceOptional': 'Reference (optional)',
  'returns.form.quantityLabel': 'Return quantity for {sku}',
  'returns.form.creating': 'Creating…',
  'returns.form.submit': 'Create return',

  'returns.devicePicker.summary': 'In-stock units of {product} ({selected} selected)',
  'returns.devicePicker.loading': 'Loading devices…',
  'returns.devicePicker.empty': 'No in-stock device can be returned.',
  'returns.devicePicker.deviceLabel': 'Return device {serial}',

  'returns.purchase.heading': 'Returns to supplier',
  'returns.purchase.help':
    'Returns post as stock issues; serialized units are disposed with full device history.',
  'returns.purchase.new': 'New purchase return',
  'returns.purchase.dialogTitle': 'Return goods to supplier',
  'returns.purchase.dialogDescription':
    'A draft return does not move stock. Posting it issues the quantity or disposes the chosen devices.',
  'returns.purchase.returnable': 'Returnable {returnable} of {received} received',
  'returns.purchase.reasonTooShort':
    'Explain why the goods are going back (at least 3 characters).',
  'returns.purchase.emptySelection': 'Enter a quantity or select at least one device to return.',
  'returns.purchase.created': 'Purchase return {number} created as a draft.',
  'returns.purchase.allReturned': 'Every received line has been returned.',
  'returns.purchase.posted': 'Return {number} posted. Stock and devices are updated.',

  'returns.sales.heading': 'Returns from customer',
  'returns.sales.help':
    'Posting a sales return receipts the quantity back into the order location.',
  'returns.sales.new': 'New sales return',
  'returns.sales.dialogTitle': 'Restock a customer return',
  'returns.sales.dialogDescription':
    "Posting the draft receipts the quantity back into the order's warehouse location.",
  'returns.sales.returnable': 'Returnable {returnable} of {fulfilled} fulfilled',
  'returns.sales.reasonTooShort': 'Explain why the goods are coming back (at least 3 characters).',
  'returns.sales.emptySelection': 'Enter a quantity to restock.',
  'returns.sales.created': 'Sales return {number} created as a draft.',
  'returns.sales.allReturned': 'Every fulfilled line has been returned.',
  'returns.sales.posted': 'Return {number} posted. Stock is restocked.',
} as const;

export type ReturnsMessages = Record<keyof typeof returns, string>;
