import 'json.dart';

enum PaymentStatus {
  unpaid,
  partial,
  paid;

  static PaymentStatus parse(String? wire) =>
      enumFromWire(PaymentStatus.values, wire, PaymentStatus.unpaid);
}

enum PaymentMethod {
  cash,
  bankTransfer,
  cardManual,
  credit;

  static PaymentMethod parse(String? wire) => switch (wire) {
    'bank_transfer' => PaymentMethod.bankTransfer,
    'card_manual' => PaymentMethod.cardManual,
    'credit' => PaymentMethod.credit,
    _ => PaymentMethod.cash,
  };

  String get wire => switch (this) {
    PaymentMethod.cash => 'cash',
    PaymentMethod.bankTransfer => 'bank_transfer',
    PaymentMethod.cardManual => 'card_manual',
    PaymentMethod.credit => 'credit',
  };
}

class Customer {
  const Customer({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.addressLine,
    this.city,
    this.countryCode,
    this.taxId,
    required this.isActive,
  });

  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? addressLine;
  final String? city;
  final String? countryCode;
  final String? taxId;
  final bool isActive;

  factory Customer.fromJson(Json json) => Customer(
    id: asString(json, 'id'),
    name: asString(json, 'name'),
    email: asStringOrNull(json, 'email'),
    phone: asStringOrNull(json, 'phone'),
    addressLine: asStringOrNull(json, 'addressLine'),
    city: asStringOrNull(json, 'city'),
    countryCode: asStringOrNull(json, 'countryCode'),
    taxId: asStringOrNull(json, 'taxId'),
    isActive: asBool(json, 'isActive', true),
  );
}

class CustomerSaveResult {
  const CustomerSaveResult({
    required this.customerId,
    required this.name,
    required this.isActive,
  });

  final String customerId;
  final String name;
  final bool isActive;

  factory CustomerSaveResult.fromJson(Json json) => CustomerSaveResult(
    customerId: asString(json, 'customerId'),
    name: asString(json, 'name'),
    isActive: asBool(json, 'isActive', true),
  );
}

enum InvoiceLineKind {
  product,
  device;

  static InvoiceLineKind parse(String? wire) =>
      wire == 'device' ? InvoiceLineKind.device : InvoiceLineKind.product;
}

/// One line as the counter has built it. Amounts stay in millimes; the server
/// computes net, tax and total, so nothing here is a total.
class InvoiceLineDraft {
  const InvoiceLineDraft({
    required this.kind,
    required this.referenceId,
    required this.sku,
    required this.name,
    required this.quantity,
    this.unitPriceMinor,
    this.taxRatePercent,
    this.serialNumber,
    this.deviceId,
    this.isSerialized = false,
  });

  final InvoiceLineKind kind;
  final String referenceId;
  final String sku;
  final String name;
  final double quantity;
  final int? unitPriceMinor;
  final double? taxRatePercent;
  final String? serialNumber;
  final String? deviceId;
  final bool isSerialized;

  bool get isDevice => kind == InvoiceLineKind.device;

  int? get lineNetMinor =>
      unitPriceMinor == null ? null : (unitPriceMinor! * quantity).round();

  InvoiceLineDraft copyWith({
    double? quantity,
    int? unitPriceMinor,
    double? taxRatePercent,
  }) => InvoiceLineDraft(
    kind: kind,
    referenceId: referenceId,
    sku: sku,
    name: name,
    quantity: quantity ?? this.quantity,
    unitPriceMinor: unitPriceMinor ?? this.unitPriceMinor,
    taxRatePercent: taxRatePercent ?? this.taxRatePercent,
    serialNumber: serialNumber,
    deviceId: deviceId,
    isSerialized: isSerialized,
  );

  Map<String, dynamic> toCreateJson() => withoutNulls({
    'kind': kind.name,
    if (kind == InvoiceLineKind.product) 'productId': referenceId,
    if (kind == InvoiceLineKind.device) 'deviceId': referenceId,
    if (kind == InvoiceLineKind.product) 'quantity': quantity,
    'unitPriceMinor': unitPriceMinor,
    'taxRatePercent': taxRatePercent,
  });

  factory InvoiceLineDraft.fromJson(Json json) => InvoiceLineDraft(
    kind: InvoiceLineKind.parse(asStringOrNull(json, 'kind')),
    referenceId: asString(json, 'productId').isEmpty
        ? asString(json, 'deviceId')
        : asString(json, 'productId'),
    sku: asString(json, 'productSku'),
    name: asString(json, 'productName'),
    quantity: asDouble(json, 'quantity', 1),
    unitPriceMinor: asIntOrNull(json, 'unitPriceMinor'),
    taxRatePercent: asDoubleOrNull(json, 'taxRatePercent'),
    serialNumber: asStringOrNull(json, 'serialNumber'),
    deviceId: asStringOrNull(json, 'deviceId'),
    isSerialized: asStringOrNull(json, 'deviceId') != null,
  );
}

class SalesInvoiceDraft {
  const SalesInvoiceDraft({
    required this.warehouseId,
    required this.locationId,
    this.customerId,
    this.customerName,
    this.customerEmail,
    this.customerPhone,
    required this.lines,
    required this.paidAmountMinor,
    required this.paymentMethod,
    this.paymentNote,
    this.reference,
    this.notes,
  });

  final String warehouseId;
  final String locationId;
  final String? customerId;
  final String? customerName;
  final String? customerEmail;
  final String? customerPhone;
  final List<InvoiceLineDraft> lines;
  final int paidAmountMinor;
  final PaymentMethod paymentMethod;
  final String? paymentNote;
  final String? reference;
  final String? notes;

  Map<String, dynamic> toJson() => withoutNulls({
    'warehouseId': warehouseId,
    'locationId': locationId,
    'customerId': customerId,
    'customerName': customerName,
    'customerEmail': customerEmail,
    'customerPhone': customerPhone,
    'lines': lines.map((line) => line.toCreateJson()).toList(growable: false),
    'paidAmountMinor': paidAmountMinor,
    'paymentMethod': paymentMethod.wire,
    'paymentNote': paymentNote,
    'reference': reference,
    'notes': notes,
  });
}

class SalesInvoiceCreateResult {
  const SalesInvoiceCreateResult({
    required this.invoiceId,
    required this.number,
    this.orderId,
    required this.lineCount,
    required this.totalQuantity,
    required this.netAmountMinor,
    required this.taxAmountMinor,
    required this.totalAmountMinor,
    required this.paidAmountMinor,
    required this.remainingAmountMinor,
    required this.paymentStatus,
    this.paymentMethod,
    this.issuedAt,
    required this.duplicate,
  });

  final String invoiceId;
  final String number;
  final String? orderId;
  final int lineCount;
  final double totalQuantity;
  final int netAmountMinor;
  final int taxAmountMinor;
  final int totalAmountMinor;
  final int paidAmountMinor;
  final int remainingAmountMinor;
  final PaymentStatus paymentStatus;
  final PaymentMethod? paymentMethod;
  final DateTime? issuedAt;
  final bool duplicate;

  factory SalesInvoiceCreateResult.fromJson(Json json) =>
      SalesInvoiceCreateResult(
        invoiceId: asString(json, 'invoiceId'),
        number: asString(json, 'number'),
        orderId: asStringOrNull(json, 'orderId'),
        lineCount: asInt(json, 'lineCount'),
        totalQuantity: asDouble(json, 'totalQuantity'),
        netAmountMinor: asInt(json, 'netAmountMinor'),
        taxAmountMinor: asInt(json, 'taxAmountMinor'),
        totalAmountMinor: asInt(json, 'totalAmountMinor'),
        paidAmountMinor: asInt(json, 'paidAmountMinor'),
        remainingAmountMinor: asInt(json, 'remainingAmountMinor'),
        paymentStatus: PaymentStatus.parse(
          asStringOrNull(json, 'paymentStatus'),
        ),
        paymentMethod: asStringOrNull(json, 'paymentMethod') == null
            ? null
            : PaymentMethod.parse(asStringOrNull(json, 'paymentMethod')),
        issuedAt: asDate(json, 'issuedAt'),
        duplicate: asBool(json, 'duplicate'),
      );
}

class SalesInvoicePaymentResult {
  const SalesInvoicePaymentResult({
    required this.invoiceId,
    required this.number,
    required this.paidAmountMinor,
    required this.remainingAmountMinor,
    required this.paymentStatus,
    this.paymentMethod,
    required this.duplicate,
  });

  final String invoiceId;
  final String number;
  final int paidAmountMinor;
  final int remainingAmountMinor;
  final PaymentStatus paymentStatus;
  final PaymentMethod? paymentMethod;
  final bool duplicate;

  factory SalesInvoicePaymentResult.fromJson(Json json) =>
      SalesInvoicePaymentResult(
        invoiceId: asString(json, 'invoiceId'),
        number: asString(json, 'number'),
        paidAmountMinor: asInt(json, 'paidAmountMinor'),
        remainingAmountMinor: asInt(json, 'remainingAmountMinor'),
        paymentStatus: PaymentStatus.parse(
          asStringOrNull(json, 'paymentStatus'),
        ),
        paymentMethod: asStringOrNull(json, 'paymentMethod') == null
            ? null
            : PaymentMethod.parse(asStringOrNull(json, 'paymentMethod')),
        duplicate: asBool(json, 'duplicate'),
      );
}

class SalesInvoiceLine {
  const SalesInvoiceLine({
    required this.id,
    required this.kind,
    required this.productId,
    required this.productSku,
    required this.productName,
    this.deviceId,
    this.serialNumber,
    required this.quantity,
    required this.unitPriceMinor,
    required this.taxRatePercent,
    required this.netAmountMinor,
    required this.taxAmountMinor,
  });

  final String id;
  final InvoiceLineKind kind;
  final String productId;
  final String productSku;
  final String productName;
  final String? deviceId;
  final String? serialNumber;
  final double quantity;
  final int unitPriceMinor;
  final double taxRatePercent;
  final int netAmountMinor;
  final int taxAmountMinor;

  factory SalesInvoiceLine.fromJson(Json json) => SalesInvoiceLine(
    id: asString(json, 'id'),
    kind: InvoiceLineKind.parse(asStringOrNull(json, 'kind')),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    deviceId: asStringOrNull(json, 'deviceId'),
    serialNumber: asStringOrNull(json, 'serialNumber'),
    quantity: asDouble(json, 'quantity'),
    unitPriceMinor: asInt(json, 'unitPriceMinor'),
    taxRatePercent: asDouble(json, 'taxRatePercent'),
    netAmountMinor: asInt(json, 'netAmountMinor'),
    taxAmountMinor: asInt(json, 'taxAmountMinor'),
  );
}

class SalesInvoicePayment {
  const SalesInvoicePayment({
    required this.id,
    required this.amountMinor,
    required this.method,
    this.note,
    this.recordedAt,
    this.recordedByEmail,
  });

  final String id;
  final int amountMinor;
  final PaymentMethod method;
  final String? note;
  final DateTime? recordedAt;
  final String? recordedByEmail;

  factory SalesInvoicePayment.fromJson(Json json) => SalesInvoicePayment(
    id: asString(json, 'id'),
    amountMinor: asInt(json, 'amountMinor'),
    method: PaymentMethod.parse(asStringOrNull(json, 'method')),
    note: asStringOrNull(json, 'note'),
    recordedAt: asDate(json, 'recordedAt'),
    recordedByEmail: asStringOrNull(json, 'recordedByEmail'),
  );
}

class SalesInvoice {
  const SalesInvoice({
    required this.id,
    required this.number,
    this.salesOrderId,
    this.salesOrderNumber,
    required this.warehouseCode,
    required this.locationCode,
    this.customerId,
    required this.customerName,
    this.customerEmail,
    this.customerPhone,
    required this.netAmountMinor,
    required this.taxAmountMinor,
    required this.totalAmountMinor,
    required this.paidAmountMinor,
    required this.remainingAmountMinor,
    required this.paymentStatus,
    this.paymentMethod,
    this.reference,
    this.notes,
    required this.lineCount,
    required this.totalQuantity,
    this.issuedAt,
    this.createdByEmail,
  });

  final String id;
  final String number;
  final String? salesOrderId;
  final String? salesOrderNumber;
  final String warehouseCode;
  final String locationCode;
  final String? customerId;
  final String customerName;
  final String? customerEmail;
  final String? customerPhone;
  final int netAmountMinor;
  final int taxAmountMinor;
  final int totalAmountMinor;
  final int paidAmountMinor;
  final int remainingAmountMinor;
  final PaymentStatus paymentStatus;
  final PaymentMethod? paymentMethod;
  final String? reference;
  final String? notes;
  final int lineCount;
  final double totalQuantity;
  final DateTime? issuedAt;
  final String? createdByEmail;

  factory SalesInvoice.fromJson(Json json) => SalesInvoice(
    id: asString(json, 'id'),
    number: asString(json, 'number'),
    salesOrderId: asStringOrNull(json, 'salesOrderId'),
    salesOrderNumber: asStringOrNull(json, 'salesOrderNumber'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    customerId: asStringOrNull(json, 'customerId'),
    customerName: asString(json, 'customerName'),
    customerEmail: asStringOrNull(json, 'customerEmail'),
    customerPhone: asStringOrNull(json, 'customerPhone'),
    netAmountMinor: asInt(json, 'netAmountMinor'),
    taxAmountMinor: asInt(json, 'taxAmountMinor'),
    totalAmountMinor: asInt(json, 'totalAmountMinor'),
    paidAmountMinor: asInt(json, 'paidAmountMinor'),
    remainingAmountMinor: asInt(json, 'remainingAmountMinor'),
    paymentStatus: PaymentStatus.parse(asStringOrNull(json, 'paymentStatus')),
    paymentMethod: asStringOrNull(json, 'paymentMethod') == null
        ? null
        : PaymentMethod.parse(asStringOrNull(json, 'paymentMethod')),
    reference: asStringOrNull(json, 'reference'),
    notes: asStringOrNull(json, 'notes'),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    issuedAt: asDate(json, 'issuedAt'),
    createdByEmail: asStringOrNull(json, 'createdByEmail'),
  );
}

class SalesInvoiceDetail {
  const SalesInvoiceDetail({
    required this.invoice,
    required this.lines,
    required this.payments,
  });

  final SalesInvoice invoice;
  final List<SalesInvoiceLine> lines;
  final List<SalesInvoicePayment> payments;

  factory SalesInvoiceDetail.fromJson(Json json) => SalesInvoiceDetail(
    invoice: SalesInvoice.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(SalesInvoiceLine.fromJson)
        .toList(growable: false),
    payments: asJsonList(json['payments'])
        .map(SalesInvoicePayment.fromJson)
        .toList(growable: false),
  );
}
