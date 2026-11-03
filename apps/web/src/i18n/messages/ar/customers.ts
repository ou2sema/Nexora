import type { CustomerMessages } from '../en/customers';

export const customers: CustomerMessages = {
  'customer.newTitle': 'عميل جديد',
  'customer.editTitle': 'تعديل العميل',
  'customer.save.failed': 'تعذّر حفظ العميل.',

  'customer.form.description':
    'الهوية التي تُطبع في الفاتورة. لا تُحفظ هنا سجلات الشراء ولا حدود الائتمان ولا الأرصدة.',
  'customer.form.name': 'الاسم',
  'customer.form.nameRequired': 'أدخل الاسم الذي يجب أن تحمله الفاتورة.',
  'customer.form.email': 'البريد الإلكتروني',
  'customer.form.invalidEmail': 'أدخل بريدًا إلكترونيًا صحيحًا أو اتركه فارغًا.',
  'customer.form.phone': 'الهاتف',
  'customer.form.address': 'العنوان',
  'customer.form.city': 'المدينة',
  'customer.form.country': 'الدولة',
  'customer.form.invalidCountry': 'استخدم رمز دولة من حرفين.',
  'customer.form.taxId': 'التعريف الجبائي',
  'customer.form.fiscalNote':
    'يُنسخ الاسم والتعريف الجبائي والعنوان إلى كل فاتورة لحظة البيع، لذا لا يستطيع أي تعديل لاحق أن يعيد كتابة وثيقة صدرت فعلًا.',
  'customer.form.save': 'حفظ العميل',
  'customer.form.create': 'إنشاء العميل',

  'customers.title': 'العملاء',
  'customers.description':
    'الدليل الذي يُفوتر منه الشباك. يمكن رغم ذلك تسمية مشتري عابر في البيع دون بطاقة.',
  'customers.newCustomer': 'عميل جديد',
  'customers.viewerReadOnly':
    'دورك «مشاهد» للقراءة فقط. المالك والمسؤول والمدير هم من يحدّثون دليل العملاء.',
  'customers.searchLabel': 'ابحث عن عميل',
  'customers.searchPlaceholder': 'الاسم أو البريد أو الهاتف أو التعريف الجبائي',
  'customers.filterLabel': 'تصفية حسب الحالة',
  'customers.allCustomers': 'كل العملاء',
  'customers.active': 'نشط',
  'customers.inactive': 'غير نشط',
  'customers.loading': 'جارٍ تحميل العملاء',
  'customers.loadFailed': 'تعذّر تحميل العملاء.',
  'customers.activationFailed': 'تعذّر تغيير حالة العميل.',
  'customers.emptyNone': 'لا عملاء بعد',
  'customers.emptyMatching': 'لا عميل مطابق',
  'customers.emptyMatchingDescription': 'عدّل البحث أو تصفية الحالة لرؤية نتائج أكثر.',
  'customers.emptyCreateDescription':
    'أضف من تفوتر لهم بانتظام؛ اسم لمرة واحدة يمكن كتابته على البيع نفسه.',
  'customers.emptyViewerDescription': 'يستطيع المالك أو المسؤول أو المدير إضافة أول عميل.',
  'customers.tableCaption': 'دليل العملاء',
  'customers.columns.customer': 'العميل',
  'customers.columns.contact': 'التواصل',
  'customers.columns.since': 'مُعرف منذ',
  'customers.taxId': 'التعريف الجبائي',
  'customers.deactivate': 'إيقاف',
  'customers.reactivate': 'إعادة تفعيل',
};
