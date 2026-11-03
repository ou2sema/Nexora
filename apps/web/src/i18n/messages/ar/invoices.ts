import type { InvoiceMessages } from '../en/invoices';

export const invoices: InvoiceMessages = {
  'invoice.paymentStatus.unpaid': 'غير مدفوعة',
  'invoice.paymentStatus.partial': 'مدفوعة جزئيًا',
  'invoice.paymentStatus.paid': 'مدفوعة',

  'invoice.method.cash': 'نقدًا',
  'invoice.method.bank_transfer': 'تحويل بنكي',
  'invoice.method.card_manual': 'بطاقة (إدخال يدوي)',
  'invoice.method.credit': 'بالآجل / على الحساب',

  'invoice.detail.title': 'الفاتورة',
  'invoice.detail.subtitle': 'جارٍ تحميل الفاتورة…',
  'invoice.detail.loading': 'جارٍ تحميل الفاتورة…',
  'invoice.detail.loadFailed': 'تعذّر تحميل الفاتورة.',
  'invoice.detail.issuedOn': 'أُصدرت في {when}',
  'invoice.detail.viewerReadOnly':
    'دورك «مشاهد» للقراءة فقط. المالك والمسؤول والمدير هم من يسجّلون الدفع.',

  'invoice.detail.customer': 'العميل',
  'invoice.detail.depot': 'المستودع',
  'invoice.detail.issued': 'التاريخ',
  'invoice.detail.volume': 'الحجم',
  'invoice.detail.lineQuantity': '{lines} سطرًا / {quantity} وحدة',
  'invoice.detail.status': 'الدفع',
  'invoice.detail.net': 'صافي (قبل الضريبة)',
  'invoice.detail.tax': 'الضريبة',
  'invoice.detail.total': 'الإجمالي (مع الضريبة)',
  'invoice.detail.paid': 'المُتحصّل',
  'invoice.detail.remaining': 'المتبقي',

  'invoice.detail.linesCaption': 'أسطر الفاتورة',
  'invoice.detail.columns.item': 'البند',
  'invoice.detail.columns.unitPrice': 'سعر الوحدة',
  'invoice.detail.columns.taxRate': 'الضريبة %',
  'invoice.detail.columns.total': 'الإجمالي',

  'invoice.detail.payments.title': 'الدفعات المسجّلة',
  'invoice.detail.payments.empty': 'لا دفعة مسجّلة على هذه الفاتورة.',

  'invoice.detail.payment.heading': 'تسجيل دفعة',
  'invoice.detail.payment.dueNow': 'بقي {remaining} على هذه الفاتورة.',
  'invoice.detail.payment.amount': 'المبلغ',
  'invoice.detail.payment.method': 'الطريقة',
  'invoice.detail.payment.note': 'ملاحظة',
  'invoice.detail.payment.submit': 'سجّل الدفعة',
  'invoice.detail.payment.invalid': 'أدخل مبلغًا بالمليم.',
  'invoice.detail.payment.exceedsRemaining': 'الدفعة أكبر من المبلغ المتبقي.',
  'invoice.detail.payment.settlesInvoice': 'هذا المبلغ يسدّد الفاتورة تمامًا.',
  'invoice.detail.payment.failed': 'تعذّر تسجيل الدفعة.',
  'invoice.detail.payment.recorded': 'سُجّلت الدفعة على {number}؛ بقي {remaining}.',
  'invoice.detail.payment.fullyPaid': 'دُفعت {number} بالكامل.',

  'invoice.detail.docs': 'الوثائق',
  'invoice.detail.docsHint':
    'كلاهما يُبنى من الفاتورة المحفوظة، فلا يمكن أن يختلف نسخة العميل عن نسخة المستودع.',
  'invoice.detail.downloadInvoice': 'فاتورة PDF',
  'invoice.detail.downloadIssueNote': 'أمر صرف PDF',
  'invoice.detail.downloaded': 'حُفظ {filename}.',
  'invoice.detail.pdfFailed': 'تعذّر تنزيل الوثيقة.',
};
