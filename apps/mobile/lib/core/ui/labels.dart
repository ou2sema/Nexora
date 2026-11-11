import '../../data/models/devices.dart';
import '../../data/models/invoicing.dart';
import '../../data/models/operations.dart';
import '../../data/models/scanning.dart';
import '../../data/models/stock.dart';
import '../../l10n/app_localizations.dart';
import '../auth/permissions.dart';
import 'widgets.dart';

String roleLabel(AppLocalizations l10n, MemberRole role) => switch (role) {
  MemberRole.owner => l10n.roleOwner,
  MemberRole.admin => l10n.roleAdmin,
  MemberRole.manager => l10n.roleManager,
  MemberRole.viewer => l10n.roleViewer,
};

String purchaseOrderStatusLabel(
  AppLocalizations l10n,
  PurchaseOrderStatus status,
) => switch (status) {
  PurchaseOrderStatus.draft => l10n.ordersStatusDraft,
  PurchaseOrderStatus.ordered => l10n.ordersStatusOrdered,
  PurchaseOrderStatus.partiallyReceived => l10n.ordersStatusPartiallyReceived,
  PurchaseOrderStatus.received => l10n.ordersStatusReceived,
  PurchaseOrderStatus.cancelled => l10n.ordersStatusCancelled,
};

PillTone purchaseOrderStatusTone(PurchaseOrderStatus status) =>
    switch (status) {
      PurchaseOrderStatus.draft => PillTone.neutral,
      PurchaseOrderStatus.ordered => PillTone.primary,
      PurchaseOrderStatus.partiallyReceived => PillTone.warning,
      PurchaseOrderStatus.received => PillTone.success,
      PurchaseOrderStatus.cancelled => PillTone.danger,
    };

String purchaseOrderStatusWire(PurchaseOrderStatus status) => switch (status) {
  PurchaseOrderStatus.draft => 'draft',
  PurchaseOrderStatus.ordered => 'ordered',
  PurchaseOrderStatus.partiallyReceived => 'partially_received',
  PurchaseOrderStatus.received => 'received',
  PurchaseOrderStatus.cancelled => 'cancelled',
};

String salesOrderStatusLabel(AppLocalizations l10n, SalesOrderStatus status) =>
    switch (status) {
      SalesOrderStatus.draft => l10n.ordersStatusDraft,
      SalesOrderStatus.confirmed => l10n.ordersStatusConfirmed,
      SalesOrderStatus.fulfilled => l10n.ordersStatusFulfilled,
      SalesOrderStatus.cancelled => l10n.ordersStatusCancelled,
    };

PillTone salesOrderStatusTone(SalesOrderStatus status) => switch (status) {
  SalesOrderStatus.draft => PillTone.neutral,
  SalesOrderStatus.confirmed => PillTone.primary,
  SalesOrderStatus.fulfilled => PillTone.success,
  SalesOrderStatus.cancelled => PillTone.danger,
};

String returnStatusLabel(AppLocalizations l10n, ReturnStatus status) =>
    switch (status) {
      ReturnStatus.draft => l10n.ordersStatusDraft,
      ReturnStatus.posted => l10n.ordersStatusPosted,
      ReturnStatus.cancelled => l10n.ordersStatusCancelled,
    };

PillTone returnStatusTone(ReturnStatus status) => switch (status) {
  ReturnStatus.draft => PillTone.neutral,
  ReturnStatus.posted => PillTone.success,
  ReturnStatus.cancelled => PillTone.danger,
};

String stockCountStatusLabel(AppLocalizations l10n, StockCountStatus status) =>
    switch (status) {
      StockCountStatus.open => l10n.ordersStatusDraft,
      StockCountStatus.posted => l10n.ordersStatusPosted,
      StockCountStatus.cancelled => l10n.ordersStatusCancelled,
    };

PillTone stockCountStatusTone(StockCountStatus status) => switch (status) {
  StockCountStatus.open => PillTone.primary,
  StockCountStatus.posted => PillTone.success,
  StockCountStatus.cancelled => PillTone.danger,
};

String paymentStatusLabel(AppLocalizations l10n, PaymentStatus status) =>
    switch (status) {
      PaymentStatus.unpaid => l10n.saleUnpaid,
      PaymentStatus.partial => l10n.salePaidPartial,
      PaymentStatus.paid => l10n.salePaidInFull,
    };

PillTone paymentStatusTone(PaymentStatus status) => switch (status) {
  PaymentStatus.unpaid => PillTone.danger,
  PaymentStatus.partial => PillTone.warning,
  PaymentStatus.paid => PillTone.success,
};

String paymentMethodLabel(AppLocalizations l10n, PaymentMethod method) =>
    switch (method) {
      PaymentMethod.cash => l10n.saleCash,
      PaymentMethod.bankTransfer => l10n.saleTransfer,
      PaymentMethod.cardManual => l10n.saleCard,
      PaymentMethod.credit => l10n.saleCredit,
    };

String deviceStatusLabel(AppLocalizations l10n, DeviceStatus status) =>
    switch (status) {
      DeviceStatus.inStock => l10n.devicesStatusInStock,
      DeviceStatus.reserved => l10n.devicesStatusReserved,
      DeviceStatus.sold => l10n.devicesStatusSold,
      DeviceStatus.returned => l10n.devicesStatusReturned,
      DeviceStatus.inRepair => l10n.devicesStatusInRepair,
      DeviceStatus.lost => l10n.devicesStatusLost,
      DeviceStatus.disposed => l10n.devicesStatusDisposed,
    };

PillTone deviceStatusTone(DeviceStatus status) => switch (status) {
  DeviceStatus.inStock => PillTone.success,
  DeviceStatus.reserved => PillTone.primary,
  DeviceStatus.sold => PillTone.neutral,
  DeviceStatus.returned => PillTone.warning,
  DeviceStatus.inRepair => PillTone.warning,
  DeviceStatus.lost => PillTone.danger,
  DeviceStatus.disposed => PillTone.neutral,
};

String trackedItemStatusLabel(
  AppLocalizations l10n,
  TrackedItemStatus status,
) => switch (status) {
  TrackedItemStatus.inStock => l10n.devicesStatusInStock,
  TrackedItemStatus.sold => l10n.devicesStatusSold,
  TrackedItemStatus.returned => l10n.devicesStatusReturned,
  TrackedItemStatus.lost => l10n.devicesStatusLost,
};

PillTone trackedItemStatusTone(TrackedItemStatus status) => switch (status) {
  TrackedItemStatus.inStock => PillTone.success,
  TrackedItemStatus.sold => PillTone.neutral,
  TrackedItemStatus.returned => PillTone.warning,
  TrackedItemStatus.lost => PillTone.danger,
};

String trackedItemEventLabel(
  AppLocalizations l10n,
  TrackedItemEventType type,
) => switch (type) {
  TrackedItemEventType.received => l10n.scanTrackedEventReceived,
  TrackedItemEventType.moved => l10n.scanTrackedEventMoved,
  TrackedItemEventType.sold => l10n.scanTrackedEventSold,
  TrackedItemEventType.returned => l10n.scanTrackedEventReturned,
  TrackedItemEventType.markedLost => l10n.scanTrackedEventMarkedLost,
  TrackedItemEventType.statusChanged => l10n.scanTrackedEventStatusChanged,
};

String deviceConditionLabel(AppLocalizations l10n, DeviceCondition condition) =>
    switch (condition) {
      DeviceCondition.newUnit => l10n.devicesNew,
      DeviceCondition.used => l10n.devicesUsed,
      DeviceCondition.refurbished => l10n.devicesRefurbished,
      DeviceCondition.damaged => l10n.devicesDamaged,
      DeviceCondition.defective => l10n.devicesDefective,
    };

String movementTypeLabel(AppLocalizations l10n, StockMovementType type) =>
    switch (type) {
      StockMovementType.receipt => l10n.stockReceipt,
      StockMovementType.issue => l10n.stockIssue,
      StockMovementType.adjustment => l10n.stockAdjustment,
      StockMovementType.transferOut => l10n.stockTransfers,
      StockMovementType.transferIn => l10n.stockTransfers,
    };

PillTone movementTypeTone(StockMovementType type) => switch (type) {
  StockMovementType.receipt => PillTone.success,
  StockMovementType.issue => PillTone.warning,
  StockMovementType.adjustment => PillTone.primary,
  StockMovementType.transferOut ||
  StockMovementType.transferIn => PillTone.neutral,
};

String stockLevelToneLabel(
  AppLocalizations l10n,
  double available,
  double threshold,
) {
  if (available <= 0) return l10n.inventoryOutOfStock;
  if (available <= threshold) return l10n.inventoryLowStock;
  return l10n.inventoryInStock;
}

PillTone stockLevelTone(double available, double threshold) {
  if (available <= 0) return PillTone.danger;
  if (available <= threshold) return PillTone.warning;
  return PillTone.success;
}
