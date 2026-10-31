import type { ReturnsMessages } from '../en/returns';

export const returns: ReturnsMessages = {
  'returns.status.draft': 'مسودة',
  'returns.status.posted': 'مُرحّل',
  'returns.status.cancelled': 'ملغى',
  'returns.loadFailed': 'تعذّر تحميل المرتجعات.',
  'returns.empty': 'لا توجد مرتجعات مسجلة لهذا الأمر.',
  'returns.columns.number': 'الرقم',
  'returns.postAction': 'ترحيل المرتجع',
  'returns.cancelAction': 'إلغاء المرتجع',
  'returns.preparing': 'جارٍ التحضير…',
  'returns.downloadPdf': 'تنزيل PDF',
  'returns.downloaded': 'تم تنزيل {filename}',
  'returns.downloadFailed': 'تعذّر إنشاء إشعار المرتجع.',
  'returns.postFailed': 'تعذّر ترحيل المرتجع.',
  'returns.cancelFailed': 'تعذّر إلغاء المرتجع.',
  'returns.cancelled': 'تم إلغاء المرتجع {number}.',
  'returns.createFailed': 'تعذّر إنشاء المرتجع.',

  'returns.form.referenceOptional': 'المرجع (اختياري)',
  'returns.form.quantityLabel': 'كمية الإرجاع للمنتج {sku}',
  'returns.form.creating': 'جارٍ الإنشاء…',
  'returns.form.submit': 'إنشاء مرتجع',

  'returns.devicePicker.summary': 'الوحدات المتوفرة من {product} ({selected} محددة)',
  'returns.devicePicker.loading': 'جارٍ تحميل الأجهزة…',
  'returns.devicePicker.empty': 'لا يوجد جهاز متوفر يمكن إرجاعه.',
  'returns.devicePicker.deviceLabel': 'إرجاع الجهاز {serial}',

  'returns.purchase.heading': 'مرتجعات إلى المورد',
  'returns.purchase.help':
    'تُرحَّل المرتجعات كصرف من المخزون؛ وتُستهلك الوحدات المتسلسلة مع سجل الجهاز الكامل.',
  'returns.purchase.new': 'مرتجع شراء جديد',
  'returns.purchase.dialogTitle': 'إرجاع البضاعة إلى المورد',
  'returns.purchase.dialogDescription':
    'مسودة المرتجع لا تحرّك المخزون. وترحيلها يصرف الكمية أو يتخلص من الأجهزة المختارة.',
  'returns.purchase.returnable': 'قابل للإرجاع: {returnable} من أصل {received} مستلمة',
  'returns.purchase.reasonTooShort': 'وضّح سبب إعادة البضاعة (3 أحرف على الأقل).',
  'returns.purchase.emptySelection': 'أدخل كمية أو اختر جهازاً واحداً على الأقل للإرجاع.',
  'returns.purchase.created': 'أُنشئ مرتجع الشراء {number} كمسودة.',
  'returns.purchase.allReturned': 'تم إرجاع جميع البنود المستلمة.',
  'returns.purchase.posted': 'تم ترحيل المرتجع {number}. تم تحديث المخزون والأجهزة.',

  'returns.sales.heading': 'مرتجعات من العميل',
  'returns.sales.help': 'يؤدي ترحيل مرتجع البيع إلى إدخال الكمية مجدداً في موقع الأمر.',
  'returns.sales.new': 'مرتجع بيع جديد',
  'returns.sales.dialogTitle': 'إعادة تخزين مرتجع عميل',
  'returns.sales.dialogDescription':
    'يؤدي ترحيل المسودة إلى إدخال الكمية مجدداً في موقع المخزون الخاص بالأمر.',
  'returns.sales.returnable': 'قابل للإرجاع: {returnable} من أصل {fulfilled} منفّذة',
  'returns.sales.reasonTooShort': 'وضّح سبب إعادة البضاعة (3 أحرف على الأقل).',
  'returns.sales.emptySelection': 'أدخل كمية لإعادة تخزينها.',
  'returns.sales.created': 'أُنشئ مرتجع البيع {number} كمسودة.',
  'returns.sales.allReturned': 'تم إرجاع جميع البنود المنفّذة.',
  'returns.sales.posted': 'تم ترحيل المرتجع {number}. تمت إعادة تخزين المخزون.',
};
