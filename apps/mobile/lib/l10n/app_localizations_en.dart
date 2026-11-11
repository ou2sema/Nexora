// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTagline => 'Your stock, in perspective.';

  @override
  String get navHome => 'Home';

  @override
  String get navInventory => 'Inventory';

  @override
  String get navScan => 'Scan';

  @override
  String get navSell => 'Sell';

  @override
  String get navMore => 'More';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonRefresh => 'Refresh';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonSave => 'Save';

  @override
  String get commonSaving => 'Saving…';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonCreate => 'Create';

  @override
  String get commonAdd => 'Add';

  @override
  String get commonEdit => 'Edit';

  @override
  String get commonRemove => 'Remove';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonClose => 'Close';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonBack => 'Back';

  @override
  String get commonNext => 'Next';

  @override
  String get commonSearch => 'Search';

  @override
  String get commonClear => 'Clear';

  @override
  String get commonAll => 'All';

  @override
  String get commonNone => 'None';

  @override
  String get commonOptional => 'Optional';

  @override
  String get commonStatus => 'Status';

  @override
  String get commonDate => 'Date';

  @override
  String get commonEmail => 'Email';

  @override
  String get commonName => 'Name';

  @override
  String get commonReason => 'Reason';

  @override
  String get commonReference => 'Reference';

  @override
  String get commonNotes => 'Notes';

  @override
  String get commonQuantity => 'Quantity';

  @override
  String get commonLocation => 'Location';

  @override
  String get commonWarehouse => 'Warehouse';

  @override
  String get commonOrganization => 'Organization';

  @override
  String get commonProduct => 'Product';

  @override
  String get commonCategory => 'Category';

  @override
  String get commonBrand => 'Brand';

  @override
  String get commonDevice => 'Device';

  @override
  String get commonSupplier => 'Supplier';

  @override
  String get commonCustomer => 'Customer';

  @override
  String get commonTotal => 'Total';

  @override
  String get commonUnits => 'units';

  @override
  String get commonActions => 'Actions';

  @override
  String get commonDetails => 'Details';

  @override
  String get commonViewAll => 'View all';

  @override
  String get commonApply => 'Apply';

  @override
  String get commonReset => 'Reset';

  @override
  String get commonDone => 'Done';

  @override
  String get commonNew => 'New';

  @override
  String get commonYes => 'Yes';

  @override
  String get commonNo => 'No';

  @override
  String get commonLanguage => 'Language';

  @override
  String get commonSignOut => 'Sign out';

  @override
  String get commonPlatformAdmin => 'Platform admin';

  @override
  String get commonFilters => 'Filters';

  @override
  String get commonSort => 'Sort';

  @override
  String commonPageOf(int page, int pages) {
    return 'Page $page of $pages';
  }

  @override
  String get commonPrevious => 'Previous';

  @override
  String get commonError => 'Something went wrong';

  @override
  String get commonSuccess => 'Done';

  @override
  String get commonRequired => 'Required';

  @override
  String get commonInvalidNumber => 'Enter a valid number';

  @override
  String get commonInvalidAmount =>
      'Enter a valid amount with up to three decimals';

  @override
  String get commonNoResults => 'No results';

  @override
  String get commonEmpty => 'Nothing here yet';

  @override
  String get commonAllWarehouses => 'All warehouses';

  @override
  String get commonVat => 'VAT';

  @override
  String get commonUnitPrice => 'Unit price';

  @override
  String get commonSku => 'SKU';

  @override
  String get commonSerial => 'Serial';

  @override
  String get commonImei => 'IMEI';

  @override
  String get commonRate => 'Rate';

  @override
  String get commonAmount => 'Amount';

  @override
  String get commonNote => 'Note';

  @override
  String get commonType => 'Type';

  @override
  String get commonFrom => 'From';

  @override
  String get commonTo => 'To';

  @override
  String commonBy(String name) {
    return 'by $name';
  }

  @override
  String commonAt(String time) {
    return 'at $time';
  }

  @override
  String get commonOf => 'of';

  @override
  String get commonItems => 'items';

  @override
  String get commonToday => 'Today';

  @override
  String get commonSearchWorkflows => 'Search workflows, screens and actions';

  @override
  String get commonViewDocument => 'View document';

  @override
  String get commonDownload => 'Download';

  @override
  String get commonShare => 'Share';

  @override
  String get commonSavedToPhone => 'Saved on this phone';

  @override
  String get commonOpen => 'Open';

  @override
  String get commonSelect => 'Select';

  @override
  String get authSignInTitle => 'Sign in';

  @override
  String get authSignUpTitle => 'Create your account';

  @override
  String get authSignInSubtitle =>
      'Use the email and password linked to your invitation.';

  @override
  String get authSignUpSubtitle =>
      'The account can join or create an organization afterwards.';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Password';

  @override
  String get authSignIn => 'Sign in';

  @override
  String get authSignUp => 'Create account';

  @override
  String get authHaveAccount => 'Already have an account?';

  @override
  String get authCreateOne => 'Create an account';

  @override
  String get authCheckInbox => 'Check your inbox';

  @override
  String authConfirmationSent(String email) {
    return 'We sent a confirmation link to $email. Confirm it, then sign in.';
  }

  @override
  String get authBackToSignIn => 'Back to sign in';

  @override
  String get authInvalidEmail => 'Enter a valid email address';

  @override
  String get authPasswordTooShort => 'Use at least 8 characters';

  @override
  String get authFailed => 'Sign-in failed.';

  @override
  String get authWelcomeBack => 'Welcome back';

  @override
  String get authSessionExpired => 'Your session expired. Sign in again.';

  @override
  String get authSecureNote =>
      'Your session is stored in the device\'s secure storage.';

  @override
  String get orgChooseTitle => 'Choose a workspace';

  @override
  String get orgChooseSubtitle => 'You belong to more than one organization.';

  @override
  String get orgSwitch => 'Switch organization';

  @override
  String get orgCurrent => 'Current organization';

  @override
  String orgPendingTitle(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'invitations',
      one: 'an invitation',
    );
    return 'You have $_temp0';
  }

  @override
  String get orgPendingBody =>
      'Accept the invitation to join the organization.';

  @override
  String get orgAccept => 'Accept invitation';

  @override
  String get orgAccepting => 'Accepting…';

  @override
  String get orgAccepted => 'Invitation accepted';

  @override
  String orgExpires(String date) {
    return 'Expires $date';
  }

  @override
  String get orgNoMembershipsTitle => 'No workspace yet';

  @override
  String get orgNoMembershipsBody =>
      'Your account is not a member of any organization. Ask an owner or administrator to invite you, or contact your Nexora platform administrator.';

  @override
  String get orgNoMembershipsNote =>
      'Nexora sends no outbound email; the owner invites your address and you accept it here after signing in.';

  @override
  String get orgRole => 'Role';

  @override
  String orgMemberOf(String organization) {
    return 'Member of $organization';
  }

  @override
  String get roleOwner => 'Owner';

  @override
  String get roleAdmin => 'Admin';

  @override
  String get roleManager => 'Manager';

  @override
  String get roleViewer => 'Viewer';

  @override
  String get homeStockValuation => 'Stock valuation';

  @override
  String homeVsLastMonth(String change) {
    return '$change vs. last month · at cost';
  }

  @override
  String get homeOnHand => 'On hand';

  @override
  String get homeReserved => 'Reserved';

  @override
  String get homeAvailable => 'Available';

  @override
  String get homeStartOperation => 'Start an operation';

  @override
  String get homeNewSale => 'New sale';

  @override
  String get homeScanItem => 'Scan item';

  @override
  String get homeNeedsAttention => 'Needs attention';

  @override
  String homeAllAlerts(int count) {
    return 'All $count alerts';
  }

  @override
  String get homeBelowReorder => 'Below reorder level';

  @override
  String get homeLowStockEmpty => 'Nothing needs attention right now.';

  @override
  String get homeRecentActivity => 'Recent activity';

  @override
  String get homeNoActivity => 'No movements in this window.';

  @override
  String get homeWindowLast7 => '7 days';

  @override
  String get homeWindowLast30 => '30 days';

  @override
  String get homeWindowLast90 => '90 days';

  @override
  String get homeOpenInventory => 'Open inventory';

  @override
  String get homeHealthOnline => 'API online';

  @override
  String get homeHealthOffline => 'API unreachable';

  @override
  String get homeHealthChecking => 'Checking API…';

  @override
  String homeStale(String time) {
    return 'Last refreshed $time';
  }

  @override
  String get inventoryTitle => 'Inventory';

  @override
  String get inventorySubtitle => 'Stock on hand, by shelf';

  @override
  String get inventorySearchHint => 'Search product, SKU or serial';

  @override
  String get inventoryAllCategories => 'All categories';

  @override
  String get inventoryStockOverview => 'Stock overview';

  @override
  String inventoryProductsUnits(String products, String units) {
    return '$products products · $units available units';
  }

  @override
  String get inventorySortName => 'Name A-Z';

  @override
  String get inventoryInStock => 'In stock';

  @override
  String get inventoryLowStock => 'Low stock';

  @override
  String get inventoryOutOfStock => 'Out of stock';

  @override
  String inventoryAvailableReserved(String available, String reserved) {
    return '$available available · $reserved reserved';
  }

  @override
  String get inventoryNoProducts => 'No products match this search.';

  @override
  String get inventoryProductDetails => 'Product details';

  @override
  String get inventoryStockByLocation => 'Stock by location';

  @override
  String get inventoryAllWarehouses => 'All warehouses';

  @override
  String get inventoryAvailableFormula => 'Available = on hand − reserved';

  @override
  String get inventoryDeviceTraceability => 'Device traceability';

  @override
  String get inventorySelectedDevice => 'Selected device';

  @override
  String inventoryViewDevices(int count) {
    return 'View all $count';
  }

  @override
  String get inventorySerialized => 'Serialized';

  @override
  String get inventoryIndividuallyTracked => 'Tracked units';

  @override
  String get inventoryIndividuallyTrackedHint =>
      'Each received unit gets its own barcode and record.';

  @override
  String get inventoryBulk => 'Bulk';

  @override
  String get inventoryReorderLevel => 'Reorder level';

  @override
  String get inventoryBarcode => 'Barcode';

  @override
  String get inventoryInternalCode => 'Internal code';

  @override
  String get inventoryDescription => 'Description';

  @override
  String get inventoryCategoryBrand => 'Category and brand';

  @override
  String get inventoryNoDevices => 'No devices registered for this product.';

  @override
  String inventoryDeviceCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count devices',
      one: '1 device',
      zero: 'No devices',
    );
    return '$_temp0';
  }

  @override
  String get inventoryOnHandShort => 'On hand';

  @override
  String get inventoryReservedShort => 'Reserved';

  @override
  String get inventoryAvailableShort => 'Available';

  @override
  String get inventoryPriceMinor => 'Retail price';

  @override
  String get inventoryCostMinor => 'Cost';

  @override
  String inventoryVatRate(String rate) {
    return '$rate% VAT';
  }

  @override
  String get scanTitle => 'Scan item';

  @override
  String get scanSubtitle => 'Barcode, SKU or device serial';

  @override
  String get scanCameraActive => 'Camera active';

  @override
  String get scanKeepInside => 'Keep the barcode or serial inside the frame';

  @override
  String get scanEnterManually => 'Or enter a code manually';

  @override
  String get scanPlaceholder => 'Barcode, serial, SKU or internal code';

  @override
  String get scanResolve => 'Resolve code';

  @override
  String get scanDeviceFound => 'Device found';

  @override
  String get scanProductFound => 'Product found';

  @override
  String get scanNotFound => 'No match for this code';

  @override
  String get scanPermissionTitle => 'Camera access';

  @override
  String get scanPermissionBody =>
      'Nexora uses the camera only while this screen is open, to read barcodes and serial numbers. Manual entry always works.';

  @override
  String get scanPermissionDenied =>
      'Camera permission was denied. Enter the code manually or allow camera access in Android settings.';

  @override
  String get scanStartCamera => 'Start camera';

  @override
  String get scanStopCamera => 'Stop camera';

  @override
  String get scanTorch => 'Torch';

  @override
  String get scanUseDeviceToSell => 'Use this device to sell';

  @override
  String get scanAddToBasket => 'Add to basket';

  @override
  String get scanViewProduct => 'Open product';

  @override
  String scanAvailableAt(String warehouse, String location) {
    return '$warehouse · $location';
  }

  @override
  String get scanWrongLocation =>
      'This unit is on another shelf and cannot join a sale from this one.';

  @override
  String scanAlreadyInBasket(String serial) {
    return '$serial is already in the basket.';
  }

  @override
  String scanDeviceNotInStock(String serial) {
    return '$serial is not available for sale.';
  }

  @override
  String get scanManualHint =>
      'A USB or Bluetooth scanner types into this field. Enter also resolves it.';

  @override
  String get scanHardwareHint =>
      'Keyboard-wedge scanners work here; the camera and typed entry stay available.';

  @override
  String get scanScanning => 'Resolving…';

  @override
  String get scanStockLines => 'Stock by location';

  @override
  String get scanTrackedItemFound => 'Unit found';

  @override
  String get scanProductBarcode => 'Product barcode';

  @override
  String get scanSerialNumber => 'Serial number';

  @override
  String get scanPurchaseOrder => 'Purchase order';

  @override
  String get scanReceivedAt => 'Received';

  @override
  String get scanHistory => 'Unit history';

  @override
  String get scanNoHistory => 'No movements recorded yet.';

  @override
  String get scanPrintLabel => 'Print label';

  @override
  String get scanTrackedEventReceived => 'Received into stock';

  @override
  String get scanTrackedEventMoved => 'Moved';

  @override
  String get scanTrackedEventSold => 'Sold';

  @override
  String get scanTrackedEventReturned => 'Returned';

  @override
  String get scanTrackedEventMarkedLost => 'Marked lost';

  @override
  String get scanTrackedEventStatusChanged => 'Status changed';

  @override
  String get saleTitle => 'Counter sale';

  @override
  String get saleSubtitle => 'Scan or search, name the buyer, take payment';

  @override
  String saleDraft(int products, String units) {
    return 'Draft · $products products / $units units';
  }

  @override
  String get saleStepBasket => 'Basket';

  @override
  String get saleStepPayment => 'Payment';

  @override
  String get saleStepDone => 'Done';

  @override
  String get saleSearchHint => 'Add by name, SKU or scan';

  @override
  String get saleBuyer => 'Buyer';

  @override
  String get saleChangeBuyer => 'Change';

  @override
  String get saleBasketHeading => 'Basket';

  @override
  String get saleTaxExclusive => 'TND · excl. VAT';

  @override
  String get saleRemoveLine => 'Remove line';

  @override
  String saleDeviceLine(String price) {
    return '1 device × $price';
  }

  @override
  String saleUnitLine(String quantity, String price) {
    return '$quantity × $price';
  }

  @override
  String get salePriceOverride => 'Price';

  @override
  String get saleTaxRate => 'VAT rate';

  @override
  String get saleSubtotal => 'Net subtotal';

  @override
  String saleVatLine(String rate) {
    return 'VAT · $rate%';
  }

  @override
  String get saleTotalLine => 'Total · TND';

  @override
  String get saleReviewPay => 'Review & pay';

  @override
  String get saleReviewTitle => 'Review & pay';

  @override
  String saleReviewSubtitle(String units) {
    return 'Counter sale · $units';
  }

  @override
  String get saleBuyerDetails => 'Buyer details';

  @override
  String get salePaymentMethod => 'Payment method';

  @override
  String get saleCash => 'Cash';

  @override
  String get saleTransfer => 'Transfer';

  @override
  String get saleCard => 'Card';

  @override
  String get saleCredit => 'Credit';

  @override
  String get saleCardHint =>
      'Card payments are recorded manually, no terminal charge.';

  @override
  String get saleCashTendered => 'Cash tendered · TND';

  @override
  String get salePaymentRecorded => 'Payment recorded';

  @override
  String get saleChangeToReturn => 'Change to return';

  @override
  String get saleChangeHint =>
      'Excess cash is change, not an invoice overpayment.';

  @override
  String get saleAdditionalDetails => 'Additional details';

  @override
  String get saleAdditionalHint => 'Reference, notes';

  @override
  String saleConfirmSale(String total) {
    return 'Confirm sale · TND $total';
  }

  @override
  String get salePosting => 'Posting the sale…';

  @override
  String get saleCompleteTitle => 'Sale complete';

  @override
  String saleCompleteBody(String buyer, String units, String location) {
    return 'Invoice issued for $buyer. $units sold from $location.';
  }

  @override
  String get saleAllPaid => 'All paid. Sale complete.';

  @override
  String get saleInvoice => 'Invoice';

  @override
  String get salePaidInFull => 'Paid in full';

  @override
  String get salePaidPartial => 'Partially paid';

  @override
  String get saleUnpaid => 'Unpaid';

  @override
  String get saleRemainingBalance => 'Remaining balance';

  @override
  String get saleCashBack => 'Cash tendered';

  @override
  String get saleNewSale => 'New sale';

  @override
  String get saleDownloadInvoice => 'Download invoice';

  @override
  String get saleDownloadIssueNote => 'Download issue note';

  @override
  String get saleOpenInvoice => 'Open invoice';

  @override
  String get saleRecentInvoices => 'Recent invoices';

  @override
  String get saleNoInvoices => 'No invoices posted yet.';

  @override
  String get saleWalkIn => 'Walk-in buyer';

  @override
  String get saleCustomerName => 'Buyer name';

  @override
  String get saleCustomerPhone => 'Phone';

  @override
  String get saleCustomerEmail => 'Email';

  @override
  String get saleSelectCustomer => 'Select customer';

  @override
  String get saleNewCustomer => 'New customer';

  @override
  String get saleEmptyBasket =>
      'The basket is empty. Scan a device or add a product.';

  @override
  String get saleNeedBuyer => 'Select a customer or name the buyer.';

  @override
  String get saleNeedShelf =>
      'Choose the warehouse and location the sale leaves from.';

  @override
  String get saleNeedItems => 'Add at least one line.';

  @override
  String get saleQtyInvalid =>
      'Use a quantity greater than zero with at most four decimals.';

  @override
  String get saleAmountInvalid =>
      'Enter a valid amount with at most three decimals.';

  @override
  String get salePriceInvalid =>
      'Enter a price in TND with at most three decimals.';

  @override
  String get saleOverpaidHint =>
      'More than the total is recorded as change, not as an invoice payment.';

  @override
  String get saleCreditHint =>
      'A credit sale records no payment now; the balance stays on the invoice.';

  @override
  String get saleLeaveTitle => 'Leave this sale?';

  @override
  String get saleLeaveBody =>
      'The basket is kept as a draft for this user and organization.';

  @override
  String get saleLeaveStay => 'Keep working';

  @override
  String get saleLeaveDraft => 'Leave and keep draft';

  @override
  String get salePayments => 'Payments';

  @override
  String get saleRecordPayment => 'Record payment';

  @override
  String get salePaymentAmount => 'Amount · TND';

  @override
  String get salePaymentNote => 'Note';

  @override
  String get salePaymentAdded => 'Payment recorded';

  @override
  String get saleBalance => 'Balance';

  @override
  String get saleSerializedTag => 'Serialized';

  @override
  String get saleSellingShelf => 'Selling shelf';

  @override
  String get saleChooseDevice => 'Choose the exact unit';

  @override
  String get saleNoSellableDevices =>
      'No in-stock unit for this product on that shelf.';

  @override
  String get saleQuantity => 'Quantity';

  @override
  String get salePrice => 'Price';

  @override
  String get saleVatPercent => 'VAT %';

  @override
  String get saleBuyerRequired => 'Name the buyer or choose a customer.';

  @override
  String get saleDuplicateScan => 'Already in the basket.';

  @override
  String get saleDeviceLocationMismatch => 'This unit is on another shelf.';

  @override
  String saleStepOf(int step, int total) {
    return 'Step $step of $total';
  }

  @override
  String get ordersTitle => 'Orders';

  @override
  String get ordersPurchases => 'Purchases';

  @override
  String get ordersSales => 'Sales';

  @override
  String get ordersReturns => 'Returns';

  @override
  String get ordersSearchHint => 'Search by number, supplier or customer';

  @override
  String get ordersNewPurchase => 'New purchase order';

  @override
  String get ordersNewSale => 'New sales order';

  @override
  String get ordersSupplier => 'Supplier';

  @override
  String get ordersDeliverTo => 'Deliver to';

  @override
  String ordersExpectedOn(String date) {
    return 'Expected $date';
  }

  @override
  String ordersOrderedOn(String date) {
    return 'Ordered $date';
  }

  @override
  String get ordersReceivingProgress => 'Receiving progress';

  @override
  String ordersUnitsProgress(String received, String ordered) {
    return '$received / $ordered units';
  }

  @override
  String get ordersOrdered => 'Ordered';

  @override
  String get ordersReceived => 'Received';

  @override
  String get ordersRemaining => 'Remaining';

  @override
  String get ordersOrderTotal => 'Order total';

  @override
  String get ordersMarkOrdered => 'Mark as ordered';

  @override
  String get ordersReceive => 'Receive';

  @override
  String get ordersCancelOrder => 'Cancel order';

  @override
  String get ordersReceiveTitle => 'Receive into stock';

  @override
  String get ordersSerials => 'Serials';

  @override
  String get ordersAddSerial => 'Add serial or IMEI';

  @override
  String get ordersSerialCountMismatch =>
      'A serialized line needs exactly one serial per received unit.';

  @override
  String get ordersReceiveNote => 'Receipt note';

  @override
  String get ordersPostReceipt => 'Post receipt';

  @override
  String get ordersReceiptPosted => 'Receipt posted';

  @override
  String get ordersNewReturn => 'New return';

  @override
  String get ordersReturnReason => 'Why are the goods going back?';

  @override
  String get ordersPostReturn => 'Post return';

  @override
  String get ordersCancelReturn => 'Cancel return';

  @override
  String get ordersReturnPosted => 'Return posted';

  @override
  String get ordersDownloadPdf => 'Download PDF';

  @override
  String get ordersPurchaseOrder => 'Purchase order';

  @override
  String get ordersSalesOrder => 'Sales order';

  @override
  String get ordersFilterStatus => 'Status';

  @override
  String get ordersCreatePurchaseTitle => 'New purchase order';

  @override
  String get ordersCreateSaleTitle => 'New sales order';

  @override
  String get ordersAddLine => 'Add line';

  @override
  String get ordersSelectSupplier => 'Select a supplier';

  @override
  String get ordersSelectProduct => 'Select a product';

  @override
  String get ordersAtLeastOneLine => 'Add at least one line.';

  @override
  String get ordersDuplicateProduct => 'Each product may appear only once.';

  @override
  String get ordersExpectedDate => 'Expected date';

  @override
  String get ordersStatusDraft => 'Draft';

  @override
  String get ordersStatusOrdered => 'Ordered';

  @override
  String get ordersStatusPartiallyReceived => 'Partially received';

  @override
  String get ordersStatusReceived => 'Received';

  @override
  String get ordersStatusCancelled => 'Cancelled';

  @override
  String get ordersStatusConfirmed => 'Confirmed';

  @override
  String get ordersStatusFulfilled => 'Fulfilled';

  @override
  String get ordersStatusPosted => 'Posted';

  @override
  String get ordersConfirmOrder => 'Confirm order';

  @override
  String get ordersFulfilOrder => 'Fulfil order';

  @override
  String get ordersNoOrders => 'No orders yet.';

  @override
  String ordersLines(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count lines',
      one: '1 line',
      zero: 'No lines',
    );
    return '$_temp0';
  }

  @override
  String get ordersQuantityOrdered => 'Ordered';

  @override
  String get ordersQuantityReceived => 'Received';

  @override
  String get ordersQuantityReturned => 'Returned';

  @override
  String get ordersUnitCost => 'Unit cost';

  @override
  String get ordersUnitPrice => 'Unit price';

  @override
  String get ordersReference => 'Reference';

  @override
  String get ordersNotes => 'Notes';

  @override
  String get ordersCustomer => 'Customer name';

  @override
  String get ordersPostReceiptHint =>
      'Bulk lines post one ledger receipt per line. Serialized lines register one device per serial.';

  @override
  String get stockTitle => 'Stock';

  @override
  String get stockMovements => 'Movements';

  @override
  String get stockTransfers => 'Transfers';

  @override
  String get stockReservations => 'Reservations';

  @override
  String get stockCounts => 'Stock counts';

  @override
  String get stockReconciliation => 'Reconciliation';

  @override
  String get stockPostMovement => 'Post movement';

  @override
  String get stockReceipt => 'Receipt';

  @override
  String get stockIssue => 'Issue';

  @override
  String get stockAdjustment => 'Adjustment';

  @override
  String get stockSignedQuantity => 'Signed quantity';

  @override
  String get stockReasonRequired => 'Adjustments require a reason.';

  @override
  String get stockPosted => 'Movement posted';

  @override
  String get stockMove => 'Move stock';

  @override
  String get stockTransferTitle => 'Transfer stock';

  @override
  String get stockSource => 'Source';

  @override
  String get stockTarget => 'Target';

  @override
  String get stockReserve => 'Reserve stock';

  @override
  String get stockRelease => 'Release';

  @override
  String get stockReservationStatus => 'Status';

  @override
  String get stockExpires => 'Expires';

  @override
  String get stockNoReservations => 'No reservations.';

  @override
  String get stockReconcileTitle => 'Stock reconciliation';

  @override
  String get stockReconcileBody =>
      'Compare the balance projection with the ledger sum. Repair rebuilds the projection without touching history.';

  @override
  String get stockBalance => 'Balance';

  @override
  String get stockLedger => 'Ledger';

  @override
  String get stockDifference => 'Difference';

  @override
  String get stockRepair => 'Repair projection';

  @override
  String get stockDryRun => 'Dry run';

  @override
  String get stockRepairApplied => 'Projection repaired';

  @override
  String get stockBalanced => 'Balance and ledger agree.';

  @override
  String get stockCountsTitle => 'Stock counts';

  @override
  String get stockNewCount => 'Start a count';

  @override
  String get stockResumeCount => 'Resume count';

  @override
  String get stockCountLines => 'Counted lines';

  @override
  String get stockAddCountLine => 'Add or increment a line';

  @override
  String get stockIncrement => 'Increment';

  @override
  String get stockSetCount => 'Set count';

  @override
  String get stockVariance => 'Variance';

  @override
  String get stockPostCount => 'Post count';

  @override
  String get stockDiscardCount => 'Discard count';

  @override
  String get stockCountPosted => 'Count posted';

  @override
  String get stockCountDiscarded => 'Count discarded';

  @override
  String get stockCountEmpty => 'No lines counted yet.';

  @override
  String get stockSerializedNotCountable =>
      'Serialized products are counted through devices, not quantity counts.';

  @override
  String get stockOpenCountExists => 'Only one count can be open per location.';

  @override
  String get stockSelectCountLocation =>
      'Choose the warehouse and location to count.';

  @override
  String get stockCountNote => 'Count note';

  @override
  String get stockMovementType => 'Movement type';

  @override
  String get stockNoMovements => 'No movements in this window.';

  @override
  String get stockReserveHint =>
      'Reserving never consumes stock; available = on hand − active reservations.';

  @override
  String get stockReservationReleased => 'Reservation released';

  @override
  String get stockQuantityAvailable => 'Available';

  @override
  String get devicesTitle => 'Devices';

  @override
  String get devicesRegister => 'Register device';

  @override
  String get devicesSerial => 'Serial number';

  @override
  String get devicesImei => 'IMEI';

  @override
  String get devicesCondition => 'Condition';

  @override
  String get devicesWarranty => 'Warranty';

  @override
  String get devicesWarrantyStart => 'Warranty start';

  @override
  String get devicesWarrantyEnd => 'Warranty end';

  @override
  String get devicesSupplierRef => 'Supplier reference';

  @override
  String get devicesStatus => 'Status';

  @override
  String get devicesEvents => 'Events';

  @override
  String get devicesMove => 'Move location';

  @override
  String get devicesChangeStatus => 'Change status';

  @override
  String get devicesSearchHint => 'Search serial, IMEI, SKU or product';

  @override
  String get devicesAllStatuses => 'All statuses';

  @override
  String devicesRegisteredAt(String date) {
    return 'Received $date';
  }

  @override
  String get devicesNew => 'New';

  @override
  String get devicesUsed => 'Used';

  @override
  String get devicesRefurbished => 'Refurbished';

  @override
  String get devicesDamaged => 'Damaged';

  @override
  String get devicesDefective => 'Defective';

  @override
  String get devicesRegisterTitle => 'Register a serialized unit';

  @override
  String get devicesDeviceRegistered => 'Device registered';

  @override
  String get devicesEventHistory => 'Event history';

  @override
  String get devicesNoEvents => 'No events recorded.';

  @override
  String get devicesMoveTitle => 'Move to another shelf';

  @override
  String get devicesStatusChanged => 'Device status updated';

  @override
  String get devicesStatusInStock => 'In stock';

  @override
  String get devicesStatusReserved => 'Reserved';

  @override
  String get devicesStatusSold => 'Sold';

  @override
  String get devicesStatusReturned => 'Returned';

  @override
  String get devicesStatusInRepair => 'In repair';

  @override
  String get devicesStatusLost => 'Lost';

  @override
  String get devicesStatusDisposed => 'Disposed';

  @override
  String get devicesNoDevices => 'No devices match this search.';

  @override
  String get suppliersTitle => 'Suppliers';

  @override
  String get suppliersNew => 'New supplier';

  @override
  String get suppliersSearchHint => 'Search suppliers';

  @override
  String get suppliersActive => 'Active';

  @override
  String get suppliersInactive => 'Inactive';

  @override
  String get suppliersActivate => 'Activate';

  @override
  String get suppliersDeactivate => 'Deactivate';

  @override
  String get suppliersContact => 'Contact name';

  @override
  String get suppliersTaxId => 'Tax ID';

  @override
  String get suppliersCity => 'City';

  @override
  String get suppliersCountry => 'Country code';

  @override
  String get suppliersAddress => 'Address';

  @override
  String get suppliersNoSuppliers => 'No suppliers yet.';

  @override
  String get suppliersSaved => 'Supplier saved';

  @override
  String get customersTitle => 'Customers';

  @override
  String get customersNew => 'New customer';

  @override
  String get customersSearchHint => 'Search customers';

  @override
  String get customersActive => 'Active';

  @override
  String get customersInactive => 'Inactive';

  @override
  String get customersActivate => 'Activate';

  @override
  String get customersDeactivate => 'Deactivate';

  @override
  String get customersPhone => 'Phone';

  @override
  String get customersNoCustomers => 'No customers yet.';

  @override
  String get customersSaved => 'Customer saved';

  @override
  String get customersTaxId => 'Tax ID';

  @override
  String get customersCity => 'City';

  @override
  String get customersAddress => 'Address';

  @override
  String get reportsTitle => 'Reports';

  @override
  String get reportsOverview => 'Overview';

  @override
  String get reportsLowStock => 'Low stock';

  @override
  String get reportsSupplierPerformance => 'Supplier performance';

  @override
  String get reportsWindow => 'Window';

  @override
  String get reportsPurchases => 'Purchase value';

  @override
  String get reportsSales => 'Retail value';

  @override
  String reportsUnpriced(int count) {
    return '$count unpriced products';
  }

  @override
  String get reportsMovements => 'Movements';

  @override
  String get reportsReceived => 'Received';

  @override
  String get reportsIssued => 'Issued';

  @override
  String get reportsNet => 'Net';

  @override
  String get reportsWarehouses => 'By warehouse';

  @override
  String get reportsExportStockLevels => 'Export stock levels CSV';

  @override
  String get reportsExportMovements => 'Export movements CSV';

  @override
  String get reportsExported => 'Export ready';

  @override
  String get reportsNoLowStock => 'Nothing is below its reorder level.';

  @override
  String get reportsProducts => 'Products';

  @override
  String get reportsAvailable => 'Available';

  @override
  String get reportsShortfall => 'Shortfall';

  @override
  String get reportsOnTime => 'On-time rate';

  @override
  String get reportsAvgLeadTime => 'Average lead time';

  @override
  String get reportsReturnRate => 'Return rate';

  @override
  String get reportsOrdersCreated => 'Orders created';

  @override
  String get reportsOrdersReceived => 'Orders received';

  @override
  String reportsGeneratedAt(String time) {
    return 'Generated $time';
  }

  @override
  String get reportsNoData => 'No data in this window.';

  @override
  String reportsDays(int count) {
    return '$count days';
  }

  @override
  String get reportsSalesValue => 'Sale value';

  @override
  String get reportsPurchaseValue => 'Purchase value';

  @override
  String get reportsLowStockTitle => 'Low stock';

  @override
  String get teamTitle => 'Team';

  @override
  String get teamMembers => 'Members';

  @override
  String get teamInvitations => 'Invitations';

  @override
  String get teamInvite => 'Invite';

  @override
  String get teamInviteTitle => 'Invite a teammate';

  @override
  String get teamRole => 'Role';

  @override
  String get teamChangeRole => 'Change role';

  @override
  String get teamRemove => 'Remove from organization';

  @override
  String teamRemoveConfirm(String email) {
    return 'Remove $email from this organization?';
  }

  @override
  String get teamManagerViewerOnly => 'Managers can invite viewers only.';

  @override
  String get teamOwnerOnly => 'Only owners can manage owner roles.';

  @override
  String get teamNoMembers => 'No members.';

  @override
  String get teamPending => 'Pending';

  @override
  String get teamAccepted => 'Accepted';

  @override
  String get teamExpired => 'Expired';

  @override
  String get teamRevoked => 'Revoked';

  @override
  String get teamRevoke => 'Revoke';

  @override
  String get teamInvitesExpire => 'Invitations expire after 14 days.';

  @override
  String teamInvitedBy(String name) {
    return 'Invited by $name';
  }

  @override
  String get teamInviteCreated => 'Invitation created';

  @override
  String get teamRoleChanged => 'Role updated';

  @override
  String get teamMemberRemoved => 'Member removed';

  @override
  String get teamInvitedEmail => 'Email address';

  @override
  String get teamAcceptInvitation => 'Accept';

  @override
  String get teamInvitationAccepted => 'Invitation accepted';

  @override
  String get teamPendingInvitations => 'Pending invitations';

  @override
  String get adminTitle => 'Administration';

  @override
  String get adminOrganizations => 'Organizations';

  @override
  String get adminAudit => 'Operator activity';

  @override
  String get adminNewOrganization => 'New organization';

  @override
  String get adminNewOrganizationTitle => 'Create an organization';

  @override
  String get adminOrgName => 'Organization name';

  @override
  String get adminOrgSlug => 'Slug';

  @override
  String get adminFirstMemberEmail => 'First member email';

  @override
  String get adminFirstMemberRole => 'First member role';

  @override
  String get adminCreateOrg => 'Create organization';

  @override
  String adminMembers(int count) {
    return '$count members';
  }

  @override
  String adminPendingInvites(int count) {
    return '$count pending';
  }

  @override
  String get adminNoOrgs => 'No organizations.';

  @override
  String get adminNoAudit => 'No operator activity.';

  @override
  String get adminAction => 'Action';

  @override
  String get adminActor => 'Actor';

  @override
  String get adminTarget => 'Target';

  @override
  String get adminOrganizationCreated => 'Organization created';

  @override
  String get adminManageTeam => 'Manage team';

  @override
  String get adminIdentityOnly =>
      'Platform administration covers identity rows only; tenant stock and sales stay behind membership.';

  @override
  String get brandingTitle => 'Branding';

  @override
  String get brandingUpload => 'Upload logo';

  @override
  String get brandingReplace => 'Replace logo';

  @override
  String get brandingRemove => 'Remove logo';

  @override
  String get brandingRemoveConfirm => 'Remove the organization logo?';

  @override
  String get brandingLogo => 'Organization logo';

  @override
  String get brandingHint =>
      'PNG or JPEG, up to 400 KB. The mark appears in the workspace and on generated documents.';

  @override
  String get brandingTooLarge => 'The image must be 400 KB or smaller.';

  @override
  String get brandingUploaded => 'Logo updated';

  @override
  String get brandingRemoved => 'Logo removed';

  @override
  String get brandingUnsupported => 'Choose a PNG or JPEG image.';

  @override
  String get documentsLabels => 'Labels';

  @override
  String get documentsSelectCopies => 'Copies';

  @override
  String get documentsLabelHint =>
      'Labels print as an A4 sheet. Choose 1 to 20 copies per item.';

  @override
  String get documentsDownloaded => 'Document ready';

  @override
  String get documentsShare => 'Share';

  @override
  String get documentsOpen => 'Open';

  @override
  String get documentsNoApp =>
      'No app on this phone can open this file. It can still be shared.';

  @override
  String get moreTitle => 'More';

  @override
  String get moreOperations => 'Operations';

  @override
  String get moreDirectory => 'Directory';

  @override
  String get moreOrganization => 'Organization';

  @override
  String get moreAccount => 'Account';

  @override
  String get moreWarehouses => 'Warehouses';

  @override
  String get moreCatalogSettings => 'Catalog settings';

  @override
  String get moreReports => 'Reports';

  @override
  String get moreAdmin => 'Platform administration';

  @override
  String get moreStockCounts => 'Stock counts';

  @override
  String get moreMovements => 'Stock movements';

  @override
  String get moreTransfers => 'Stock transfers';

  @override
  String get moreReservations => 'Reservations';

  @override
  String get moreReconciliation => 'Reconciliation';

  @override
  String get moreDevices => 'Devices';

  @override
  String get moreSuppliers => 'Suppliers';

  @override
  String get moreCustomers => 'Customers';

  @override
  String get morePurchaseOrders => 'Purchase orders';

  @override
  String get moreSalesOrders => 'Sales orders';

  @override
  String get moreBranding => 'Branding';

  @override
  String get moreTeam => 'Team';

  @override
  String get moreLanguage => 'Language';

  @override
  String get moreSignOut => 'Sign out';

  @override
  String get moreNoResults => 'No workflow matches this search.';

  @override
  String moreSignedInAs(String email) {
    return 'Signed in as $email';
  }

  @override
  String get moreInventory => 'Inventory';

  @override
  String get moreStockLevels => 'Stock levels';

  @override
  String get moreReturns => 'Returns';

  @override
  String get errorNetwork =>
      'The API could not be reached. Check the connection and try again.';

  @override
  String get errorTimeout => 'The request took too long. Try again.';

  @override
  String get errorUnauthorized =>
      'Your session is no longer valid. Sign in again.';

  @override
  String get errorForbidden =>
      'Your role does not allow this action. The server refuses it.';

  @override
  String get errorNotFound =>
      'This item was not found, or it belongs to another organization.';

  @override
  String get errorConflict =>
      'This operation conflicts with the current data. Refresh and try again.';

  @override
  String get errorValidation => 'Check the highlighted fields.';

  @override
  String errorRateLimited(int seconds) {
    return 'Too many requests. Try again in $seconds seconds.';
  }

  @override
  String get errorServer => 'The server could not complete the request.';

  @override
  String get errorUnknown => 'Something unexpected happened.';

  @override
  String errorRequestId(String requestId) {
    return 'Support reference: $requestId';
  }

  @override
  String get errorSessionExpired => 'Session expired';

  @override
  String get errorIdempotency =>
      'This request was already posted with different data. Review it and try again.';

  @override
  String get errorInsufficientStock =>
      'Not enough stock available for this operation.';

  @override
  String get errorServerEnforced =>
      'The server is the authority for permissions, stock and totals.';

  @override
  String get errorServerMessage => 'Server message';

  @override
  String get errorPermissionDenied => 'Permission denied';

  @override
  String get errorCameraRequired => 'Camera permission is required to scan.';

  @override
  String get commonLoadMore => 'Load more';

  @override
  String get moreInvoices => 'Invoices';

  @override
  String get stockReservationActive => 'Active';

  @override
  String get stockReservationReleasedStatus => 'Released';

  @override
  String get stockReservationFulfilled => 'Fulfilled';

  @override
  String get stockReservationExpiredStatus => 'Expired';

  @override
  String get warehousesNew => 'New warehouse';

  @override
  String get warehousesCode => 'Code';

  @override
  String get warehousesCity => 'City';

  @override
  String get warehousesLocations => 'Locations';

  @override
  String get warehousesAddLocation => 'Add location';

  @override
  String get warehousesLocationCode => 'Location code';

  @override
  String get warehousesLocationName => 'Location name';

  @override
  String get warehousesSaved => 'Warehouse saved';

  @override
  String get catalogNewCategory => 'New category';

  @override
  String get catalogNewBrand => 'New brand';

  @override
  String get stockSameLocation => 'Choose two different locations';

  @override
  String get stockTransferred => 'Stock moved';

  @override
  String get languageSystem => 'System default';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageFrench => 'Français';

  @override
  String get languageArabic => 'العربية';

  @override
  String get moreConnection => 'API connection';

  @override
  String get connectionTitle => 'API connection';

  @override
  String get connectionIntro =>
      'The app sends every request to this address. It is stored on this device only; your account and data do not change.';

  @override
  String get connectionApiLabel => 'API address';

  @override
  String get connectionHint => 'https://nexora-web-service.onrender.com/api/v1';

  @override
  String connectionBuiltIn(String url) {
    return 'Built-in address: $url';
  }

  @override
  String get connectionCustom => 'Custom address on this device';

  @override
  String get connectionNoBuiltIn => 'This build has no built-in address.';

  @override
  String get connectionTest => 'Test';

  @override
  String get connectionTesting => 'Testing…';

  @override
  String connectionTestOk(int milliseconds) {
    return 'Reachable, answered in $milliseconds ms.';
  }

  @override
  String connectionTestFailed(String message) {
    return 'No answer: $message';
  }

  @override
  String get connectionInvalid =>
      'Enter an http(s) address with a host, such as https://nexora-web-service.onrender.com/api/v1.';

  @override
  String get connectionSaved => 'API address saved.';

  @override
  String get connectionReset => 'Use the built-in address';

  @override
  String get connectionWaking =>
      'A free Render instance can take up to a minute to wake on the first call.';

  @override
  String get errorApiNotConfigured =>
      'No API address is set. Open API connection settings on this device.';
}
