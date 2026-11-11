import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/errors/api_exception.dart';
import '../../core/storage/scoped_store.dart';
import '../../data/models/catalog.dart';
import '../../data/models/devices.dart';
import '../../data/models/invoicing.dart';
import '../../data/models/json.dart';
import '../../data/providers.dart';

enum SaleStep { basket, review, done }

class SaleDraftState {
  const SaleDraftState({
    this.step = SaleStep.basket,
    this.warehouseId,
    this.warehouseName,
    this.locationId,
    this.locationName,
    this.customer,
    this.buyerName = '',
    this.buyerPhone,
    this.buyerEmail,
    this.lines = const [],
    this.paymentMethod = PaymentMethod.cash,
    this.paidAmountMinor = 0,
    this.notes = '',
    this.paymentNote = '',
    this.result,
    this.busy = false,
    this.failure,
  });

  final SaleStep step;
  final String? warehouseId;
  final String? warehouseName;
  final String? locationId;
  final String? locationName;
  final Customer? customer;
  final String buyerName;
  final String? buyerPhone;
  final String? buyerEmail;
  final List<InvoiceLineDraft> lines;
  final PaymentMethod paymentMethod;
  final int paidAmountMinor;
  final String notes;
  final String paymentNote;
  final SalesInvoiceCreateResult? result;
  final bool busy;
  final ApiException? failure;

  bool get hasShelf => warehouseId != null && locationId != null;
  bool get isEmpty => lines.isEmpty;

  String get buyerLabel =>
      customer?.name ?? (buyerName.trim().isEmpty ? '—' : buyerName.trim());

  int get netMinor => lines.fold(
    0,
    (sum, line) => sum + ((line.unitPriceMinor ?? 0) * line.quantity).round(),
  );

  int get taxMinor => lines.fold(0, (sum, line) {
    final net = ((line.unitPriceMinor ?? 0) * line.quantity).round();
    final rate = line.taxRatePercent ?? 0;
    return sum + (net * rate / 100).round();
  });

  int get totalMinor => netMinor + taxMinor;

  int get changeMinor =>
      paidAmountMinor > totalMinor ? paidAmountMinor - totalMinor : 0;

  double get totalQuantity => lines.fold(0, (sum, line) => sum + line.quantity);

  SaleDraftState copyWith({
    SaleStep? step,
    String? warehouseId,
    String? warehouseName,
    String? locationId,
    String? locationName,
    Customer? customer,
    bool clearCustomer = false,
    String? buyerName,
    String? buyerPhone,
    String? buyerEmail,
    bool clearBuyerPhone = false,
    bool clearBuyerEmail = false,
    List<InvoiceLineDraft>? lines,
    PaymentMethod? paymentMethod,
    int? paidAmountMinor,
    String? notes,
    String? paymentNote,
    SalesInvoiceCreateResult? result,
    bool clearResult = false,
    bool? busy,
    ApiException? failure,
    bool clearFailure = false,
  }) => SaleDraftState(
    step: step ?? this.step,
    warehouseId: warehouseId ?? this.warehouseId,
    warehouseName: warehouseName ?? this.warehouseName,
    locationId: locationId ?? this.locationId,
    locationName: locationName ?? this.locationName,
    customer: clearCustomer ? null : (customer ?? this.customer),
    buyerName: buyerName ?? this.buyerName,
    buyerPhone: clearBuyerPhone ? null : (buyerPhone ?? this.buyerPhone),
    buyerEmail: clearBuyerEmail ? null : (buyerEmail ?? this.buyerEmail),
    lines: lines ?? this.lines,
    paymentMethod: paymentMethod ?? this.paymentMethod,
    paidAmountMinor: paidAmountMinor ?? this.paidAmountMinor,
    notes: notes ?? this.notes,
    paymentNote: paymentNote ?? this.paymentNote,
    result: clearResult ? null : (result ?? this.result),
    busy: busy ?? this.busy,
    failure: clearFailure ? null : (failure ?? this.failure),
  );
}

enum DeviceAddResult { added, duplicate, notSellable, wrongLocation }

/// The cashier basket. It is scoped to the signed-in user and organization,
/// survives leaving the Sell tab, and is cleared only once the invoice exists.
class SaleDraftController extends Notifier<SaleDraftState> {
  static const _draftKey = 'sale.draft';

  ScopedStore? _store;
  bool _loaded = false;
  final IdempotencyGuard _guard = IdempotencyGuard();

  @override
  SaleDraftState build() {
    final session = ref.watch(
      sessionProvider.select((state) => (state.userId, state.organizationId)),
    );
    _store = null;
    _loaded = false;
    final userId = session.$1;
    final organizationId = session.$2;
    if (userId == null || organizationId == null) return const SaleDraftState();
    Future.microtask(() => _load(userId, organizationId));
    return const SaleDraftState();
  }

  Future<void> _load(String userId, String organizationId) async {
    final store = await ScopedStore.open(
      userId: userId,
      organizationId: organizationId,
    );
    if (_loaded) return;
    _store = store;
    _loaded = true;
    final json = store.readJson(_draftKey);
    if (json == null) return;
    final lines = asJsonList(json['lines'])
        .map(_decodeLine)
        .toList(growable: true);
    if (lines.isEmpty) return;
    state = SaleDraftState(
      warehouseId: asStringOrNull(json, 'warehouseId'),
      warehouseName: asStringOrNull(json, 'warehouseName'),
      locationId: asStringOrNull(json, 'locationId'),
      locationName: asStringOrNull(json, 'locationName'),
      buyerName: asString(json, 'buyerName'),
      buyerPhone: asStringOrNull(json, 'buyerPhone'),
      buyerEmail: asStringOrNull(json, 'buyerEmail'),
      lines: lines,
    );
  }

  void _persist() {
    final store = _store;
    if (store == null) return;
    final snapshot = state;
    if (snapshot.lines.isEmpty) {
      store.remove(_draftKey);
      return;
    }
    store.writeJson(_draftKey, {
      'warehouseId': snapshot.warehouseId,
      'warehouseName': snapshot.warehouseName,
      'locationId': snapshot.locationId,
      'locationName': snapshot.locationName,
      'buyerName': snapshot.buyerName,
      'buyerPhone': snapshot.buyerPhone,
      'buyerEmail': snapshot.buyerEmail,
      'lines': snapshot.lines.map(_encodeLine).toList(growable: false),
    });
  }

  void setShelf({
    required String warehouseId,
    required String warehouseName,
    required String locationId,
    required String locationName,
  }) {
    state = state.copyWith(
      warehouseId: warehouseId,
      warehouseName: warehouseName,
      locationId: locationId,
      locationName: locationName,
    );
    _persist();
  }

  void setWarehouseOnly({
    required String warehouseId,
    required String warehouseName,
  }) {
    state = state.copyWith(
      warehouseId: warehouseId,
      warehouseName: warehouseName,
    );
    _persist();
  }

  void setLocationOnly({
    required String locationId,
    required String locationName,
  }) {
    state = state.copyWith(locationId: locationId, locationName: locationName);
    _persist();
  }

  /// Adds or bumps a bulk line. A serialized product must arrive as a device.
  bool addProduct(
    Product product, {
    double quantity = 1,
    String? warehouseId,
    String? locationId,
  }) {
    if (product.isSerialized) return false;
    final index = state.lines.indexWhere(
      (line) =>
          line.kind == InvoiceLineKind.product &&
          line.referenceId == product.id,
    );
    final lines = [...state.lines];
    if (index >= 0) {
      final line = lines[index];
      lines[index] = line.copyWith(quantity: line.quantity + quantity);
    } else {
      lines.add(
        InvoiceLineDraft(
          kind: InvoiceLineKind.product,
          referenceId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: quantity,
          unitPriceMinor: product.salePriceMinor,
        ),
      );
    }
    state = state.copyWith(
      lines: lines,
      warehouseId: warehouseId ?? state.warehouseId,
      locationId: locationId ?? state.locationId,
      clearFailure: true,
    );
    _persist();
    return true;
  }

  /// A device line is one serial number. Its price is the product's selling
  /// price at the moment it lands in the basket; the counter may override it.
  Future<DeviceAddResult> addDevice(
    Device device, {
    int? unitPriceMinor,
  }) async {
    if (!device.isSellable) return DeviceAddResult.notSellable;
    if (state.lines.any((line) => line.deviceId == device.id)) {
      return DeviceAddResult.duplicate;
    }
    if (state.hasShelf &&
        (state.warehouseId != device.warehouseId ||
            state.locationId != device.locationId)) {
      return DeviceAddResult.wrongLocation;
    }

    var price = unitPriceMinor;
    if (price == null) {
      final organizationId = ref.read(organizationIdProvider);
      if (organizationId != null) {
        try {
          final product = await ref
              .read(nexoraApiProvider)
              .getProduct(organizationId, device.productId);
          price = product.salePriceMinor;
        } on ApiException {
          price = null;
        }
      }
    }

    final lines = [
      ...state.lines,
      InvoiceLineDraft(
        kind: InvoiceLineKind.device,
        referenceId: device.id,
        sku: device.productSku,
        name: device.productName,
        quantity: 1,
        unitPriceMinor: price,
        serialNumber: device.serialNumber,
        deviceId: device.id,
        isSerialized: true,
      ),
    ];
    state = state.copyWith(
      lines: lines,
      warehouseId: device.warehouseId,
      locationId: device.locationId,
      clearFailure: true,
    );
    _persist();
    return DeviceAddResult.added;
  }

  void updateQuantity(String referenceId, double quantity) {
    final lines = [...state.lines];
    final index = lines.indexWhere((line) => line.referenceId == referenceId);
    if (index < 0) return;
    if (quantity <= 0) {
      lines.removeAt(index);
    } else {
      lines[index] = lines[index].copyWith(quantity: quantity);
    }
    state = state.copyWith(lines: lines);
    _persist();
  }

  void updatePrice(String referenceId, int? minor) {
    final lines = [...state.lines];
    final index = lines.indexWhere((line) => line.referenceId == referenceId);
    if (index < 0) return;
    lines[index] = InvoiceLineDraft(
      kind: lines[index].kind,
      referenceId: lines[index].referenceId,
      sku: lines[index].sku,
      name: lines[index].name,
      quantity: lines[index].quantity,
      unitPriceMinor: minor,
      taxRatePercent: lines[index].taxRatePercent,
      serialNumber: lines[index].serialNumber,
      deviceId: lines[index].deviceId,
      isSerialized: lines[index].isSerialized,
    );
    state = state.copyWith(lines: lines);
    _persist();
  }

  void updateTaxRate(String referenceId, double? percent) {
    final lines = [...state.lines];
    final index = lines.indexWhere((line) => line.referenceId == referenceId);
    if (index < 0) return;
    lines[index] = InvoiceLineDraft(
      kind: lines[index].kind,
      referenceId: lines[index].referenceId,
      sku: lines[index].sku,
      name: lines[index].name,
      quantity: lines[index].quantity,
      unitPriceMinor: lines[index].unitPriceMinor,
      taxRatePercent: percent,
      serialNumber: lines[index].serialNumber,
      deviceId: lines[index].deviceId,
      isSerialized: lines[index].isSerialized,
    );
    state = state.copyWith(lines: lines);
    _persist();
  }

  void removeLine(String referenceId) {
    state = state.copyWith(
      lines: state.lines
          .where((line) => line.referenceId != referenceId)
          .toList(growable: false),
    );
    _persist();
  }

  void setCustomer(Customer? customer) {
    if (customer == null) {
      state = state.copyWith(clearCustomer: true);
      return;
    }
    state = state.copyWith(
      customer: customer,
      buyerName: customer.name,
      buyerPhone: customer.phone,
      buyerEmail: customer.email,
      clearBuyerPhone: customer.phone == null,
      clearBuyerEmail: customer.email == null,
    );
  }

  void setBuyerName(String name) {
    state = state.copyWith(buyerName: name);
    _persist();
  }

  void setBuyerPhone(String value) {
    final phone = value.trim();
    state = state.copyWith(buyerPhone: phone, clearBuyerPhone: phone.isEmpty);
  }

  void setBuyerEmail(String value) {
    final email = value.trim();
    state = state.copyWith(buyerEmail: email, clearBuyerEmail: email.isEmpty);
  }

  void setPaymentMethod(PaymentMethod method) {
    state = state.copyWith(
      paymentMethod: method,
      paidAmountMinor: method == PaymentMethod.credit
          ? 0
          : state.paidAmountMinor,
    );
  }

  void setPaidAmount(int minor) =>
      state = state.copyWith(paidAmountMinor: minor);
  void setNotes(String value) => state = state.copyWith(notes: value);
  void setPaymentNote(String value) =>
      state = state.copyWith(paymentNote: value);

  bool startReview({required String walkInName}) {
    if (state.lines.isEmpty) return false;
    if (!state.hasShelf) return false;
    final buyer = state.customer == null && state.buyerName.trim().isEmpty
        ? walkInName
        : state.buyerName;
    state = state.copyWith(
      step: SaleStep.review,
      buyerName: buyer,
      paidAmountMinor: state.paymentMethod == PaymentMethod.credit
          ? 0
          : state.totalMinor,
      clearFailure: true,
    );
    _persist();
    return true;
  }

  void backToBasket() =>
      state = state.copyWith(step: SaleStep.basket, clearFailure: true);

  Future<bool> submit() async {
    final organizationId = ref.read(organizationIdProvider);
    final snapshot = state;
    if (organizationId == null ||
        snapshot.lines.isEmpty ||
        !snapshot.hasShelf) {
      return false;
    }
    if (snapshot.buyerName.trim().isEmpty && snapshot.customer == null) {
      return false;
    }

    state = state.copyWith(busy: true, clearFailure: true);
    final draft = SalesInvoiceDraft(
      warehouseId: snapshot.warehouseId!,
      locationId: snapshot.locationId!,
      customerId: snapshot.customer?.id,
      customerName: snapshot.customer == null
          ? snapshot.buyerName.trim()
          : null,
      customerEmail: snapshot.customer == null ? snapshot.buyerEmail : null,
      customerPhone: snapshot.customer == null ? snapshot.buyerPhone : null,
      lines: snapshot.lines,
      paidAmountMinor: snapshot.paidAmountMinor.clamp(0, snapshot.totalMinor),
      paymentMethod: snapshot.paymentMethod,
      paymentNote: snapshot.paymentNote.trim().isEmpty
          ? null
          : snapshot.paymentNote.trim(),
      notes: snapshot.notes.trim().isEmpty ? null : snapshot.notes.trim(),
    );

    try {
      final result = await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .createInvoice(organizationId, draft, idempotencyKey: key),
      );
      state = state.copyWith(
        step: SaleStep.done,
        result: result,
        busy: false,
        clearFailure: true,
      );
      await _store?.remove(_draftKey);
      ref.invalidate(invoicesProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(movementsProvider);
      ref.invalidate(reportOverviewProvider);
      ref.invalidate(lowStockProvider);
      ref.invalidate(productsProvider);
      return true;
    } on ApiException catch (error) {
      state = state.copyWith(busy: false, failure: error);
      return false;
    } catch (error) {
      state = state.copyWith(
        busy: false,
        failure: ApiException(
          kind: ApiFailureKind.unknown,
          code: 'unexpected_payload',
          message: error.toString(),
        ),
      );
      return false;
    }
  }

  void reset() {
    _guard.settle();
    state = const SaleDraftState();
    _persist();
  }

  Map<String, dynamic> _encodeLine(InvoiceLineDraft line) => {
    'kind': line.kind.name,
    'referenceId': line.referenceId,
    'sku': line.sku,
    'name': line.name,
    'quantity': line.quantity,
    'unitPriceMinor': line.unitPriceMinor,
    'taxRatePercent': line.taxRatePercent,
    'serialNumber': line.serialNumber,
    'deviceId': line.deviceId,
    'isSerialized': line.isSerialized,
  };

  InvoiceLineDraft _decodeLine(Json json) => InvoiceLineDraft(
    kind: InvoiceLineKind.parse(asStringOrNull(json, 'kind')),
    referenceId: asString(json, 'referenceId'),
    sku: asString(json, 'sku'),
    name: asString(json, 'name'),
    quantity: asDouble(json, 'quantity', 1),
    unitPriceMinor: asIntOrNull(json, 'unitPriceMinor'),
    taxRatePercent: asDoubleOrNull(json, 'taxRatePercent'),
    serialNumber: asStringOrNull(json, 'serialNumber'),
    deviceId: asStringOrNull(json, 'deviceId'),
    isSerialized: asBool(json, 'isSerialized'),
  );
}

final saleDraftProvider = NotifierProvider<SaleDraftController, SaleDraftState>(
  SaleDraftController.new,
);
