import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('fr'),
  ];

  /// No description provided for @appTagline.
  ///
  /// In en, this message translates to:
  /// **'Your stock, in perspective.'**
  String get appTagline;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navInventory.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get navInventory;

  /// No description provided for @navScan.
  ///
  /// In en, this message translates to:
  /// **'Scan'**
  String get navScan;

  /// No description provided for @navSell.
  ///
  /// In en, this message translates to:
  /// **'Sell'**
  String get navSell;

  /// No description provided for @navMore.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get navMore;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get commonRetry;

  /// No description provided for @commonRefresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get commonRefresh;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get commonLoading;

  /// No description provided for @commonSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonSave;

  /// No description provided for @commonSaving.
  ///
  /// In en, this message translates to:
  /// **'Saving…'**
  String get commonSaving;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonCreate.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get commonCreate;

  /// No description provided for @commonAdd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get commonAdd;

  /// No description provided for @commonEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get commonEdit;

  /// No description provided for @commonRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get commonRemove;

  /// No description provided for @commonDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get commonDelete;

  /// No description provided for @commonClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get commonClose;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get commonBack;

  /// No description provided for @commonNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get commonNext;

  /// No description provided for @commonSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get commonSearch;

  /// No description provided for @commonClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get commonClear;

  /// No description provided for @commonAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get commonAll;

  /// No description provided for @commonNone.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get commonNone;

  /// No description provided for @commonOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get commonOptional;

  /// No description provided for @commonStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get commonStatus;

  /// No description provided for @commonDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get commonDate;

  /// No description provided for @commonEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get commonEmail;

  /// No description provided for @commonName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get commonName;

  /// No description provided for @commonReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get commonReason;

  /// No description provided for @commonReference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get commonReference;

  /// No description provided for @commonNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get commonNotes;

  /// No description provided for @commonQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get commonQuantity;

  /// No description provided for @commonLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get commonLocation;

  /// No description provided for @commonWarehouse.
  ///
  /// In en, this message translates to:
  /// **'Warehouse'**
  String get commonWarehouse;

  /// No description provided for @commonOrganization.
  ///
  /// In en, this message translates to:
  /// **'Organization'**
  String get commonOrganization;

  /// No description provided for @commonProduct.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get commonProduct;

  /// No description provided for @commonCategory.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get commonCategory;

  /// No description provided for @commonBrand.
  ///
  /// In en, this message translates to:
  /// **'Brand'**
  String get commonBrand;

  /// No description provided for @commonDevice.
  ///
  /// In en, this message translates to:
  /// **'Device'**
  String get commonDevice;

  /// No description provided for @commonSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get commonSupplier;

  /// No description provided for @commonCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get commonCustomer;

  /// No description provided for @commonTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get commonTotal;

  /// No description provided for @commonUnits.
  ///
  /// In en, this message translates to:
  /// **'units'**
  String get commonUnits;

  /// No description provided for @commonActions.
  ///
  /// In en, this message translates to:
  /// **'Actions'**
  String get commonActions;

  /// No description provided for @commonDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get commonDetails;

  /// No description provided for @commonViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get commonViewAll;

  /// No description provided for @commonApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get commonApply;

  /// No description provided for @commonReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get commonReset;

  /// No description provided for @commonDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get commonDone;

  /// No description provided for @commonNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get commonNew;

  /// No description provided for @commonYes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get commonYes;

  /// No description provided for @commonNo.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get commonNo;

  /// No description provided for @commonLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get commonLanguage;

  /// No description provided for @commonSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get commonSignOut;

  /// No description provided for @commonPlatformAdmin.
  ///
  /// In en, this message translates to:
  /// **'Platform admin'**
  String get commonPlatformAdmin;

  /// No description provided for @commonFilters.
  ///
  /// In en, this message translates to:
  /// **'Filters'**
  String get commonFilters;

  /// No description provided for @commonSort.
  ///
  /// In en, this message translates to:
  /// **'Sort'**
  String get commonSort;

  /// No description provided for @commonPageOf.
  ///
  /// In en, this message translates to:
  /// **'Page {page} of {pages}'**
  String commonPageOf(int page, int pages);

  /// No description provided for @commonPrevious.
  ///
  /// In en, this message translates to:
  /// **'Previous'**
  String get commonPrevious;

  /// No description provided for @commonError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get commonError;

  /// No description provided for @commonSuccess.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get commonSuccess;

  /// No description provided for @commonRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get commonRequired;

  /// No description provided for @commonInvalidNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid number'**
  String get commonInvalidNumber;

  /// No description provided for @commonInvalidAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid amount with up to three decimals'**
  String get commonInvalidAmount;

  /// No description provided for @commonNoResults.
  ///
  /// In en, this message translates to:
  /// **'No results'**
  String get commonNoResults;

  /// No description provided for @commonEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get commonEmpty;

  /// No description provided for @commonAllWarehouses.
  ///
  /// In en, this message translates to:
  /// **'All warehouses'**
  String get commonAllWarehouses;

  /// No description provided for @commonVat.
  ///
  /// In en, this message translates to:
  /// **'VAT'**
  String get commonVat;

  /// No description provided for @commonUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit price'**
  String get commonUnitPrice;

  /// No description provided for @commonSku.
  ///
  /// In en, this message translates to:
  /// **'SKU'**
  String get commonSku;

  /// No description provided for @commonSerial.
  ///
  /// In en, this message translates to:
  /// **'Serial'**
  String get commonSerial;

  /// No description provided for @commonImei.
  ///
  /// In en, this message translates to:
  /// **'IMEI'**
  String get commonImei;

  /// No description provided for @commonRate.
  ///
  /// In en, this message translates to:
  /// **'Rate'**
  String get commonRate;

  /// No description provided for @commonAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get commonAmount;

  /// No description provided for @commonNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get commonNote;

  /// No description provided for @commonType.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get commonType;

  /// No description provided for @commonFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get commonFrom;

  /// No description provided for @commonTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get commonTo;

  /// No description provided for @commonBy.
  ///
  /// In en, this message translates to:
  /// **'by {name}'**
  String commonBy(String name);

  /// No description provided for @commonAt.
  ///
  /// In en, this message translates to:
  /// **'at {time}'**
  String commonAt(String time);

  /// No description provided for @commonOf.
  ///
  /// In en, this message translates to:
  /// **'of'**
  String get commonOf;

  /// No description provided for @commonItems.
  ///
  /// In en, this message translates to:
  /// **'items'**
  String get commonItems;

  /// No description provided for @commonToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get commonToday;

  /// No description provided for @commonSearchWorkflows.
  ///
  /// In en, this message translates to:
  /// **'Search workflows, screens and actions'**
  String get commonSearchWorkflows;

  /// No description provided for @commonViewDocument.
  ///
  /// In en, this message translates to:
  /// **'View document'**
  String get commonViewDocument;

  /// No description provided for @commonDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get commonDownload;

  /// No description provided for @commonShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get commonShare;

  /// No description provided for @commonSavedToPhone.
  ///
  /// In en, this message translates to:
  /// **'Saved on this phone'**
  String get commonSavedToPhone;

  /// No description provided for @commonOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get commonOpen;

  /// No description provided for @commonSelect.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get commonSelect;

  /// No description provided for @authSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authSignInTitle;

  /// No description provided for @authSignUpTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get authSignUpTitle;

  /// No description provided for @authSignInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Use the email and password linked to your invitation.'**
  String get authSignInSubtitle;

  /// No description provided for @authSignUpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The account can join or create an organization afterwards.'**
  String get authSignUpSubtitle;

  /// No description provided for @authEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authEmail;

  /// No description provided for @authPassword.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authPassword;

  /// No description provided for @authSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authSignIn;

  /// No description provided for @authSignUp.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get authSignUp;

  /// No description provided for @authHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get authHaveAccount;

  /// No description provided for @authCreateOne.
  ///
  /// In en, this message translates to:
  /// **'Create an account'**
  String get authCreateOne;

  /// No description provided for @authCheckInbox.
  ///
  /// In en, this message translates to:
  /// **'Check your inbox'**
  String get authCheckInbox;

  /// No description provided for @authConfirmationSent.
  ///
  /// In en, this message translates to:
  /// **'We sent a confirmation link to {email}. Confirm it, then sign in.'**
  String authConfirmationSent(String email);

  /// No description provided for @authBackToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get authBackToSignIn;

  /// No description provided for @authInvalidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get authInvalidEmail;

  /// No description provided for @authPasswordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters'**
  String get authPasswordTooShort;

  /// No description provided for @authFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign-in failed.'**
  String get authFailed;

  /// No description provided for @authWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get authWelcomeBack;

  /// No description provided for @authSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session expired. Sign in again.'**
  String get authSessionExpired;

  /// No description provided for @authSecureNote.
  ///
  /// In en, this message translates to:
  /// **'Your session is stored in the device\'s secure storage.'**
  String get authSecureNote;

  /// No description provided for @orgChooseTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a workspace'**
  String get orgChooseTitle;

  /// No description provided for @orgChooseSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You belong to more than one organization.'**
  String get orgChooseSubtitle;

  /// No description provided for @orgSwitch.
  ///
  /// In en, this message translates to:
  /// **'Switch organization'**
  String get orgSwitch;

  /// No description provided for @orgCurrent.
  ///
  /// In en, this message translates to:
  /// **'Current organization'**
  String get orgCurrent;

  /// No description provided for @orgPendingTitle.
  ///
  /// In en, this message translates to:
  /// **'You have {count, plural, =1{an invitation} other{invitations}}'**
  String orgPendingTitle(int count);

  /// No description provided for @orgPendingBody.
  ///
  /// In en, this message translates to:
  /// **'Accept the invitation to join the organization.'**
  String get orgPendingBody;

  /// No description provided for @orgAccept.
  ///
  /// In en, this message translates to:
  /// **'Accept invitation'**
  String get orgAccept;

  /// No description provided for @orgAccepting.
  ///
  /// In en, this message translates to:
  /// **'Accepting…'**
  String get orgAccepting;

  /// No description provided for @orgAccepted.
  ///
  /// In en, this message translates to:
  /// **'Invitation accepted'**
  String get orgAccepted;

  /// No description provided for @orgExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires {date}'**
  String orgExpires(String date);

  /// No description provided for @orgNoMembershipsTitle.
  ///
  /// In en, this message translates to:
  /// **'No workspace yet'**
  String get orgNoMembershipsTitle;

  /// No description provided for @orgNoMembershipsBody.
  ///
  /// In en, this message translates to:
  /// **'Your account is not a member of any organization. Ask an owner or administrator to invite you, or contact your Nexora platform administrator.'**
  String get orgNoMembershipsBody;

  /// No description provided for @orgNoMembershipsNote.
  ///
  /// In en, this message translates to:
  /// **'Nexora sends no outbound email; the owner invites your address and you accept it here after signing in.'**
  String get orgNoMembershipsNote;

  /// No description provided for @orgRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get orgRole;

  /// No description provided for @orgMemberOf.
  ///
  /// In en, this message translates to:
  /// **'Member of {organization}'**
  String orgMemberOf(String organization);

  /// No description provided for @roleOwner.
  ///
  /// In en, this message translates to:
  /// **'Owner'**
  String get roleOwner;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get roleAdmin;

  /// No description provided for @roleManager.
  ///
  /// In en, this message translates to:
  /// **'Manager'**
  String get roleManager;

  /// No description provided for @roleViewer.
  ///
  /// In en, this message translates to:
  /// **'Viewer'**
  String get roleViewer;

  /// No description provided for @homeStockValuation.
  ///
  /// In en, this message translates to:
  /// **'Stock valuation'**
  String get homeStockValuation;

  /// No description provided for @homeVsLastMonth.
  ///
  /// In en, this message translates to:
  /// **'{change} vs. last month · at cost'**
  String homeVsLastMonth(String change);

  /// No description provided for @homeOnHand.
  ///
  /// In en, this message translates to:
  /// **'On hand'**
  String get homeOnHand;

  /// No description provided for @homeReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get homeReserved;

  /// No description provided for @homeAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get homeAvailable;

  /// No description provided for @homeStartOperation.
  ///
  /// In en, this message translates to:
  /// **'Start an operation'**
  String get homeStartOperation;

  /// No description provided for @homeNewSale.
  ///
  /// In en, this message translates to:
  /// **'New sale'**
  String get homeNewSale;

  /// No description provided for @homeScanItem.
  ///
  /// In en, this message translates to:
  /// **'Scan item'**
  String get homeScanItem;

  /// No description provided for @homeNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'Needs attention'**
  String get homeNeedsAttention;

  /// No description provided for @homeAllAlerts.
  ///
  /// In en, this message translates to:
  /// **'All {count} alerts'**
  String homeAllAlerts(int count);

  /// No description provided for @homeBelowReorder.
  ///
  /// In en, this message translates to:
  /// **'Below reorder level'**
  String get homeBelowReorder;

  /// No description provided for @homeLowStockEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing needs attention right now.'**
  String get homeLowStockEmpty;

  /// No description provided for @homeRecentActivity.
  ///
  /// In en, this message translates to:
  /// **'Recent activity'**
  String get homeRecentActivity;

  /// No description provided for @homeNoActivity.
  ///
  /// In en, this message translates to:
  /// **'No movements in this window.'**
  String get homeNoActivity;

  /// No description provided for @homeWindowLast7.
  ///
  /// In en, this message translates to:
  /// **'7 days'**
  String get homeWindowLast7;

  /// No description provided for @homeWindowLast30.
  ///
  /// In en, this message translates to:
  /// **'30 days'**
  String get homeWindowLast30;

  /// No description provided for @homeWindowLast90.
  ///
  /// In en, this message translates to:
  /// **'90 days'**
  String get homeWindowLast90;

  /// No description provided for @homeOpenInventory.
  ///
  /// In en, this message translates to:
  /// **'Open inventory'**
  String get homeOpenInventory;

  /// No description provided for @homeHealthOnline.
  ///
  /// In en, this message translates to:
  /// **'API online'**
  String get homeHealthOnline;

  /// No description provided for @homeHealthOffline.
  ///
  /// In en, this message translates to:
  /// **'API unreachable'**
  String get homeHealthOffline;

  /// No description provided for @homeHealthChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking API…'**
  String get homeHealthChecking;

  /// No description provided for @homeStale.
  ///
  /// In en, this message translates to:
  /// **'Last refreshed {time}'**
  String homeStale(String time);

  /// No description provided for @inventoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get inventoryTitle;

  /// No description provided for @inventorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Stock on hand, by shelf'**
  String get inventorySubtitle;

  /// No description provided for @inventorySearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search product, SKU or serial'**
  String get inventorySearchHint;

  /// No description provided for @inventoryAllCategories.
  ///
  /// In en, this message translates to:
  /// **'All categories'**
  String get inventoryAllCategories;

  /// No description provided for @inventoryStockOverview.
  ///
  /// In en, this message translates to:
  /// **'Stock overview'**
  String get inventoryStockOverview;

  /// No description provided for @inventoryProductsUnits.
  ///
  /// In en, this message translates to:
  /// **'{products} products · {units} available units'**
  String inventoryProductsUnits(String products, String units);

  /// No description provided for @inventorySortName.
  ///
  /// In en, this message translates to:
  /// **'Name A-Z'**
  String get inventorySortName;

  /// No description provided for @inventoryInStock.
  ///
  /// In en, this message translates to:
  /// **'In stock'**
  String get inventoryInStock;

  /// No description provided for @inventoryLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get inventoryLowStock;

  /// No description provided for @inventoryOutOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of stock'**
  String get inventoryOutOfStock;

  /// No description provided for @inventoryAvailableReserved.
  ///
  /// In en, this message translates to:
  /// **'{available} available · {reserved} reserved'**
  String inventoryAvailableReserved(String available, String reserved);

  /// No description provided for @inventoryNoProducts.
  ///
  /// In en, this message translates to:
  /// **'No products match this search.'**
  String get inventoryNoProducts;

  /// No description provided for @inventoryProductDetails.
  ///
  /// In en, this message translates to:
  /// **'Product details'**
  String get inventoryProductDetails;

  /// No description provided for @inventoryStockByLocation.
  ///
  /// In en, this message translates to:
  /// **'Stock by location'**
  String get inventoryStockByLocation;

  /// No description provided for @inventoryAllWarehouses.
  ///
  /// In en, this message translates to:
  /// **'All warehouses'**
  String get inventoryAllWarehouses;

  /// No description provided for @inventoryAvailableFormula.
  ///
  /// In en, this message translates to:
  /// **'Available = on hand − reserved'**
  String get inventoryAvailableFormula;

  /// No description provided for @inventoryDeviceTraceability.
  ///
  /// In en, this message translates to:
  /// **'Device traceability'**
  String get inventoryDeviceTraceability;

  /// No description provided for @inventorySelectedDevice.
  ///
  /// In en, this message translates to:
  /// **'Selected device'**
  String get inventorySelectedDevice;

  /// No description provided for @inventoryViewDevices.
  ///
  /// In en, this message translates to:
  /// **'View all {count}'**
  String inventoryViewDevices(int count);

  /// No description provided for @inventorySerialized.
  ///
  /// In en, this message translates to:
  /// **'Serialized'**
  String get inventorySerialized;

  /// No description provided for @inventoryIndividuallyTracked.
  ///
  /// In en, this message translates to:
  /// **'Tracked units'**
  String get inventoryIndividuallyTracked;

  /// No description provided for @inventoryIndividuallyTrackedHint.
  ///
  /// In en, this message translates to:
  /// **'Each received unit gets its own barcode and record.'**
  String get inventoryIndividuallyTrackedHint;

  /// No description provided for @inventoryBulk.
  ///
  /// In en, this message translates to:
  /// **'Bulk'**
  String get inventoryBulk;

  /// No description provided for @inventoryReorderLevel.
  ///
  /// In en, this message translates to:
  /// **'Reorder level'**
  String get inventoryReorderLevel;

  /// No description provided for @inventoryBarcode.
  ///
  /// In en, this message translates to:
  /// **'Barcode'**
  String get inventoryBarcode;

  /// No description provided for @inventoryInternalCode.
  ///
  /// In en, this message translates to:
  /// **'Internal code'**
  String get inventoryInternalCode;

  /// No description provided for @inventoryDescription.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get inventoryDescription;

  /// No description provided for @inventoryCategoryBrand.
  ///
  /// In en, this message translates to:
  /// **'Category and brand'**
  String get inventoryCategoryBrand;

  /// No description provided for @inventoryNoDevices.
  ///
  /// In en, this message translates to:
  /// **'No devices registered for this product.'**
  String get inventoryNoDevices;

  /// No description provided for @inventoryDeviceCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No devices} =1{1 device} other{{count} devices}}'**
  String inventoryDeviceCount(int count);

  /// No description provided for @inventoryOnHandShort.
  ///
  /// In en, this message translates to:
  /// **'On hand'**
  String get inventoryOnHandShort;

  /// No description provided for @inventoryReservedShort.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get inventoryReservedShort;

  /// No description provided for @inventoryAvailableShort.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get inventoryAvailableShort;

  /// No description provided for @inventoryPriceMinor.
  ///
  /// In en, this message translates to:
  /// **'Retail price'**
  String get inventoryPriceMinor;

  /// No description provided for @inventoryCostMinor.
  ///
  /// In en, this message translates to:
  /// **'Cost'**
  String get inventoryCostMinor;

  /// No description provided for @inventoryVatRate.
  ///
  /// In en, this message translates to:
  /// **'{rate}% VAT'**
  String inventoryVatRate(String rate);

  /// No description provided for @scanTitle.
  ///
  /// In en, this message translates to:
  /// **'Scan item'**
  String get scanTitle;

  /// No description provided for @scanSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Barcode, SKU or device serial'**
  String get scanSubtitle;

  /// No description provided for @scanCameraActive.
  ///
  /// In en, this message translates to:
  /// **'Camera active'**
  String get scanCameraActive;

  /// No description provided for @scanKeepInside.
  ///
  /// In en, this message translates to:
  /// **'Keep the barcode or serial inside the frame'**
  String get scanKeepInside;

  /// No description provided for @scanEnterManually.
  ///
  /// In en, this message translates to:
  /// **'Or enter a code manually'**
  String get scanEnterManually;

  /// No description provided for @scanPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Barcode, serial, SKU or internal code'**
  String get scanPlaceholder;

  /// No description provided for @scanResolve.
  ///
  /// In en, this message translates to:
  /// **'Resolve code'**
  String get scanResolve;

  /// No description provided for @scanDeviceFound.
  ///
  /// In en, this message translates to:
  /// **'Device found'**
  String get scanDeviceFound;

  /// No description provided for @scanProductFound.
  ///
  /// In en, this message translates to:
  /// **'Product found'**
  String get scanProductFound;

  /// No description provided for @scanNotFound.
  ///
  /// In en, this message translates to:
  /// **'No match for this code'**
  String get scanNotFound;

  /// No description provided for @scanPermissionTitle.
  ///
  /// In en, this message translates to:
  /// **'Camera access'**
  String get scanPermissionTitle;

  /// No description provided for @scanPermissionBody.
  ///
  /// In en, this message translates to:
  /// **'Nexora uses the camera only while this screen is open, to read barcodes and serial numbers. Manual entry always works.'**
  String get scanPermissionBody;

  /// No description provided for @scanPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Camera permission was denied. Enter the code manually or allow camera access in Android settings.'**
  String get scanPermissionDenied;

  /// No description provided for @scanStartCamera.
  ///
  /// In en, this message translates to:
  /// **'Start camera'**
  String get scanStartCamera;

  /// No description provided for @scanStopCamera.
  ///
  /// In en, this message translates to:
  /// **'Stop camera'**
  String get scanStopCamera;

  /// No description provided for @scanTorch.
  ///
  /// In en, this message translates to:
  /// **'Torch'**
  String get scanTorch;

  /// No description provided for @scanUseDeviceToSell.
  ///
  /// In en, this message translates to:
  /// **'Use this device to sell'**
  String get scanUseDeviceToSell;

  /// No description provided for @scanAddToBasket.
  ///
  /// In en, this message translates to:
  /// **'Add to basket'**
  String get scanAddToBasket;

  /// No description provided for @scanViewProduct.
  ///
  /// In en, this message translates to:
  /// **'Open product'**
  String get scanViewProduct;

  /// No description provided for @scanAvailableAt.
  ///
  /// In en, this message translates to:
  /// **'{warehouse} · {location}'**
  String scanAvailableAt(String warehouse, String location);

  /// No description provided for @scanWrongLocation.
  ///
  /// In en, this message translates to:
  /// **'This unit is on another shelf and cannot join a sale from this one.'**
  String get scanWrongLocation;

  /// No description provided for @scanAlreadyInBasket.
  ///
  /// In en, this message translates to:
  /// **'{serial} is already in the basket.'**
  String scanAlreadyInBasket(String serial);

  /// No description provided for @scanDeviceNotInStock.
  ///
  /// In en, this message translates to:
  /// **'{serial} is not available for sale.'**
  String scanDeviceNotInStock(String serial);

  /// No description provided for @scanManualHint.
  ///
  /// In en, this message translates to:
  /// **'A USB or Bluetooth scanner types into this field. Enter also resolves it.'**
  String get scanManualHint;

  /// No description provided for @scanHardwareHint.
  ///
  /// In en, this message translates to:
  /// **'Keyboard-wedge scanners work here; the camera and typed entry stay available.'**
  String get scanHardwareHint;

  /// No description provided for @scanScanning.
  ///
  /// In en, this message translates to:
  /// **'Resolving…'**
  String get scanScanning;

  /// No description provided for @scanStockLines.
  ///
  /// In en, this message translates to:
  /// **'Stock by location'**
  String get scanStockLines;

  /// No description provided for @scanTrackedItemFound.
  ///
  /// In en, this message translates to:
  /// **'Unit found'**
  String get scanTrackedItemFound;

  /// No description provided for @scanProductBarcode.
  ///
  /// In en, this message translates to:
  /// **'Product barcode'**
  String get scanProductBarcode;

  /// No description provided for @scanSerialNumber.
  ///
  /// In en, this message translates to:
  /// **'Serial number'**
  String get scanSerialNumber;

  /// No description provided for @scanPurchaseOrder.
  ///
  /// In en, this message translates to:
  /// **'Purchase order'**
  String get scanPurchaseOrder;

  /// No description provided for @scanReceivedAt.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get scanReceivedAt;

  /// No description provided for @scanHistory.
  ///
  /// In en, this message translates to:
  /// **'Unit history'**
  String get scanHistory;

  /// No description provided for @scanNoHistory.
  ///
  /// In en, this message translates to:
  /// **'No movements recorded yet.'**
  String get scanNoHistory;

  /// No description provided for @scanPrintLabel.
  ///
  /// In en, this message translates to:
  /// **'Print label'**
  String get scanPrintLabel;

  /// No description provided for @scanTrackedEventReceived.
  ///
  /// In en, this message translates to:
  /// **'Received into stock'**
  String get scanTrackedEventReceived;

  /// No description provided for @scanTrackedEventMoved.
  ///
  /// In en, this message translates to:
  /// **'Moved'**
  String get scanTrackedEventMoved;

  /// No description provided for @scanTrackedEventSold.
  ///
  /// In en, this message translates to:
  /// **'Sold'**
  String get scanTrackedEventSold;

  /// No description provided for @scanTrackedEventReturned.
  ///
  /// In en, this message translates to:
  /// **'Returned'**
  String get scanTrackedEventReturned;

  /// No description provided for @scanTrackedEventMarkedLost.
  ///
  /// In en, this message translates to:
  /// **'Marked lost'**
  String get scanTrackedEventMarkedLost;

  /// No description provided for @scanTrackedEventStatusChanged.
  ///
  /// In en, this message translates to:
  /// **'Status changed'**
  String get scanTrackedEventStatusChanged;

  /// No description provided for @saleTitle.
  ///
  /// In en, this message translates to:
  /// **'Counter sale'**
  String get saleTitle;

  /// No description provided for @saleSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Scan or search, name the buyer, take payment'**
  String get saleSubtitle;

  /// No description provided for @saleDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft · {products} products / {units} units'**
  String saleDraft(int products, String units);

  /// No description provided for @saleStepBasket.
  ///
  /// In en, this message translates to:
  /// **'Basket'**
  String get saleStepBasket;

  /// No description provided for @saleStepPayment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get saleStepPayment;

  /// No description provided for @saleStepDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get saleStepDone;

  /// No description provided for @saleSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Add by name, SKU or scan'**
  String get saleSearchHint;

  /// No description provided for @saleBuyer.
  ///
  /// In en, this message translates to:
  /// **'Buyer'**
  String get saleBuyer;

  /// No description provided for @saleChangeBuyer.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get saleChangeBuyer;

  /// No description provided for @saleBasketHeading.
  ///
  /// In en, this message translates to:
  /// **'Basket'**
  String get saleBasketHeading;

  /// No description provided for @saleTaxExclusive.
  ///
  /// In en, this message translates to:
  /// **'TND · excl. VAT'**
  String get saleTaxExclusive;

  /// No description provided for @saleRemoveLine.
  ///
  /// In en, this message translates to:
  /// **'Remove line'**
  String get saleRemoveLine;

  /// No description provided for @saleDeviceLine.
  ///
  /// In en, this message translates to:
  /// **'1 device × {price}'**
  String saleDeviceLine(String price);

  /// No description provided for @saleUnitLine.
  ///
  /// In en, this message translates to:
  /// **'{quantity} × {price}'**
  String saleUnitLine(String quantity, String price);

  /// No description provided for @salePriceOverride.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get salePriceOverride;

  /// No description provided for @saleTaxRate.
  ///
  /// In en, this message translates to:
  /// **'VAT rate'**
  String get saleTaxRate;

  /// No description provided for @saleSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Net subtotal'**
  String get saleSubtotal;

  /// No description provided for @saleVatLine.
  ///
  /// In en, this message translates to:
  /// **'VAT · {rate}%'**
  String saleVatLine(String rate);

  /// No description provided for @saleTotalLine.
  ///
  /// In en, this message translates to:
  /// **'Total · TND'**
  String get saleTotalLine;

  /// No description provided for @saleReviewPay.
  ///
  /// In en, this message translates to:
  /// **'Review & pay'**
  String get saleReviewPay;

  /// No description provided for @saleReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Review & pay'**
  String get saleReviewTitle;

  /// No description provided for @saleReviewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Counter sale · {units}'**
  String saleReviewSubtitle(String units);

  /// No description provided for @saleBuyerDetails.
  ///
  /// In en, this message translates to:
  /// **'Buyer details'**
  String get saleBuyerDetails;

  /// No description provided for @salePaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'Payment method'**
  String get salePaymentMethod;

  /// No description provided for @saleCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get saleCash;

  /// No description provided for @saleTransfer.
  ///
  /// In en, this message translates to:
  /// **'Transfer'**
  String get saleTransfer;

  /// No description provided for @saleCard.
  ///
  /// In en, this message translates to:
  /// **'Card'**
  String get saleCard;

  /// No description provided for @saleCredit.
  ///
  /// In en, this message translates to:
  /// **'Credit'**
  String get saleCredit;

  /// No description provided for @saleCardHint.
  ///
  /// In en, this message translates to:
  /// **'Card payments are recorded manually, no terminal charge.'**
  String get saleCardHint;

  /// No description provided for @saleCashTendered.
  ///
  /// In en, this message translates to:
  /// **'Cash tendered · TND'**
  String get saleCashTendered;

  /// No description provided for @salePaymentRecorded.
  ///
  /// In en, this message translates to:
  /// **'Payment recorded'**
  String get salePaymentRecorded;

  /// No description provided for @saleChangeToReturn.
  ///
  /// In en, this message translates to:
  /// **'Change to return'**
  String get saleChangeToReturn;

  /// No description provided for @saleChangeHint.
  ///
  /// In en, this message translates to:
  /// **'Excess cash is change, not an invoice overpayment.'**
  String get saleChangeHint;

  /// No description provided for @saleAdditionalDetails.
  ///
  /// In en, this message translates to:
  /// **'Additional details'**
  String get saleAdditionalDetails;

  /// No description provided for @saleAdditionalHint.
  ///
  /// In en, this message translates to:
  /// **'Reference, notes'**
  String get saleAdditionalHint;

  /// No description provided for @saleConfirmSale.
  ///
  /// In en, this message translates to:
  /// **'Confirm sale · TND {total}'**
  String saleConfirmSale(String total);

  /// No description provided for @salePosting.
  ///
  /// In en, this message translates to:
  /// **'Posting the sale…'**
  String get salePosting;

  /// No description provided for @saleCompleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Sale complete'**
  String get saleCompleteTitle;

  /// No description provided for @saleCompleteBody.
  ///
  /// In en, this message translates to:
  /// **'Invoice issued for {buyer}. {units} sold from {location}.'**
  String saleCompleteBody(String buyer, String units, String location);

  /// No description provided for @saleAllPaid.
  ///
  /// In en, this message translates to:
  /// **'All paid. Sale complete.'**
  String get saleAllPaid;

  /// No description provided for @saleInvoice.
  ///
  /// In en, this message translates to:
  /// **'Invoice'**
  String get saleInvoice;

  /// No description provided for @salePaidInFull.
  ///
  /// In en, this message translates to:
  /// **'Paid in full'**
  String get salePaidInFull;

  /// No description provided for @salePaidPartial.
  ///
  /// In en, this message translates to:
  /// **'Partially paid'**
  String get salePaidPartial;

  /// No description provided for @saleUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get saleUnpaid;

  /// No description provided for @saleRemainingBalance.
  ///
  /// In en, this message translates to:
  /// **'Remaining balance'**
  String get saleRemainingBalance;

  /// No description provided for @saleCashBack.
  ///
  /// In en, this message translates to:
  /// **'Cash tendered'**
  String get saleCashBack;

  /// No description provided for @saleNewSale.
  ///
  /// In en, this message translates to:
  /// **'New sale'**
  String get saleNewSale;

  /// No description provided for @saleDownloadInvoice.
  ///
  /// In en, this message translates to:
  /// **'Download invoice'**
  String get saleDownloadInvoice;

  /// No description provided for @saleDownloadIssueNote.
  ///
  /// In en, this message translates to:
  /// **'Download issue note'**
  String get saleDownloadIssueNote;

  /// No description provided for @saleOpenInvoice.
  ///
  /// In en, this message translates to:
  /// **'Open invoice'**
  String get saleOpenInvoice;

  /// No description provided for @saleRecentInvoices.
  ///
  /// In en, this message translates to:
  /// **'Recent invoices'**
  String get saleRecentInvoices;

  /// No description provided for @saleNoInvoices.
  ///
  /// In en, this message translates to:
  /// **'No invoices posted yet.'**
  String get saleNoInvoices;

  /// No description provided for @saleWalkIn.
  ///
  /// In en, this message translates to:
  /// **'Walk-in buyer'**
  String get saleWalkIn;

  /// No description provided for @saleCustomerName.
  ///
  /// In en, this message translates to:
  /// **'Buyer name'**
  String get saleCustomerName;

  /// No description provided for @saleCustomerPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get saleCustomerPhone;

  /// No description provided for @saleCustomerEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get saleCustomerEmail;

  /// No description provided for @saleSelectCustomer.
  ///
  /// In en, this message translates to:
  /// **'Select customer'**
  String get saleSelectCustomer;

  /// No description provided for @saleNewCustomer.
  ///
  /// In en, this message translates to:
  /// **'New customer'**
  String get saleNewCustomer;

  /// No description provided for @saleEmptyBasket.
  ///
  /// In en, this message translates to:
  /// **'The basket is empty. Scan a device or add a product.'**
  String get saleEmptyBasket;

  /// No description provided for @saleNeedBuyer.
  ///
  /// In en, this message translates to:
  /// **'Select a customer or name the buyer.'**
  String get saleNeedBuyer;

  /// No description provided for @saleNeedShelf.
  ///
  /// In en, this message translates to:
  /// **'Choose the warehouse and location the sale leaves from.'**
  String get saleNeedShelf;

  /// No description provided for @saleNeedItems.
  ///
  /// In en, this message translates to:
  /// **'Add at least one line.'**
  String get saleNeedItems;

  /// No description provided for @saleQtyInvalid.
  ///
  /// In en, this message translates to:
  /// **'Use a quantity greater than zero with at most four decimals.'**
  String get saleQtyInvalid;

  /// No description provided for @saleAmountInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid amount with at most three decimals.'**
  String get saleAmountInvalid;

  /// No description provided for @salePriceInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a price in TND with at most three decimals.'**
  String get salePriceInvalid;

  /// No description provided for @saleOverpaidHint.
  ///
  /// In en, this message translates to:
  /// **'More than the total is recorded as change, not as an invoice payment.'**
  String get saleOverpaidHint;

  /// No description provided for @saleCreditHint.
  ///
  /// In en, this message translates to:
  /// **'A credit sale records no payment now; the balance stays on the invoice.'**
  String get saleCreditHint;

  /// No description provided for @saleLeaveTitle.
  ///
  /// In en, this message translates to:
  /// **'Leave this sale?'**
  String get saleLeaveTitle;

  /// No description provided for @saleLeaveBody.
  ///
  /// In en, this message translates to:
  /// **'The basket is kept as a draft for this user and organization.'**
  String get saleLeaveBody;

  /// No description provided for @saleLeaveStay.
  ///
  /// In en, this message translates to:
  /// **'Keep working'**
  String get saleLeaveStay;

  /// No description provided for @saleLeaveDraft.
  ///
  /// In en, this message translates to:
  /// **'Leave and keep draft'**
  String get saleLeaveDraft;

  /// No description provided for @salePayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get salePayments;

  /// No description provided for @saleRecordPayment.
  ///
  /// In en, this message translates to:
  /// **'Record payment'**
  String get saleRecordPayment;

  /// No description provided for @salePaymentAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount · TND'**
  String get salePaymentAmount;

  /// No description provided for @salePaymentNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get salePaymentNote;

  /// No description provided for @salePaymentAdded.
  ///
  /// In en, this message translates to:
  /// **'Payment recorded'**
  String get salePaymentAdded;

  /// No description provided for @saleBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get saleBalance;

  /// No description provided for @saleSerializedTag.
  ///
  /// In en, this message translates to:
  /// **'Serialized'**
  String get saleSerializedTag;

  /// No description provided for @saleSellingShelf.
  ///
  /// In en, this message translates to:
  /// **'Selling shelf'**
  String get saleSellingShelf;

  /// No description provided for @saleChooseDevice.
  ///
  /// In en, this message translates to:
  /// **'Choose the exact unit'**
  String get saleChooseDevice;

  /// No description provided for @saleNoSellableDevices.
  ///
  /// In en, this message translates to:
  /// **'No in-stock unit for this product on that shelf.'**
  String get saleNoSellableDevices;

  /// No description provided for @saleQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get saleQuantity;

  /// No description provided for @salePrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get salePrice;

  /// No description provided for @saleVatPercent.
  ///
  /// In en, this message translates to:
  /// **'VAT %'**
  String get saleVatPercent;

  /// No description provided for @saleBuyerRequired.
  ///
  /// In en, this message translates to:
  /// **'Name the buyer or choose a customer.'**
  String get saleBuyerRequired;

  /// No description provided for @saleDuplicateScan.
  ///
  /// In en, this message translates to:
  /// **'Already in the basket.'**
  String get saleDuplicateScan;

  /// No description provided for @saleDeviceLocationMismatch.
  ///
  /// In en, this message translates to:
  /// **'This unit is on another shelf.'**
  String get saleDeviceLocationMismatch;

  /// No description provided for @saleStepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {step} of {total}'**
  String saleStepOf(int step, int total);

  /// No description provided for @ordersTitle.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get ordersTitle;

  /// No description provided for @ordersPurchases.
  ///
  /// In en, this message translates to:
  /// **'Purchases'**
  String get ordersPurchases;

  /// No description provided for @ordersSales.
  ///
  /// In en, this message translates to:
  /// **'Sales'**
  String get ordersSales;

  /// No description provided for @ordersReturns.
  ///
  /// In en, this message translates to:
  /// **'Returns'**
  String get ordersReturns;

  /// No description provided for @ordersSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search by number, supplier or customer'**
  String get ordersSearchHint;

  /// No description provided for @ordersNewPurchase.
  ///
  /// In en, this message translates to:
  /// **'New purchase order'**
  String get ordersNewPurchase;

  /// No description provided for @ordersNewSale.
  ///
  /// In en, this message translates to:
  /// **'New sales order'**
  String get ordersNewSale;

  /// No description provided for @ordersSupplier.
  ///
  /// In en, this message translates to:
  /// **'Supplier'**
  String get ordersSupplier;

  /// No description provided for @ordersDeliverTo.
  ///
  /// In en, this message translates to:
  /// **'Deliver to'**
  String get ordersDeliverTo;

  /// No description provided for @ordersExpectedOn.
  ///
  /// In en, this message translates to:
  /// **'Expected {date}'**
  String ordersExpectedOn(String date);

  /// No description provided for @ordersOrderedOn.
  ///
  /// In en, this message translates to:
  /// **'Ordered {date}'**
  String ordersOrderedOn(String date);

  /// No description provided for @ordersReceivingProgress.
  ///
  /// In en, this message translates to:
  /// **'Receiving progress'**
  String get ordersReceivingProgress;

  /// No description provided for @ordersUnitsProgress.
  ///
  /// In en, this message translates to:
  /// **'{received} / {ordered} units'**
  String ordersUnitsProgress(String received, String ordered);

  /// No description provided for @ordersOrdered.
  ///
  /// In en, this message translates to:
  /// **'Ordered'**
  String get ordersOrdered;

  /// No description provided for @ordersReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get ordersReceived;

  /// No description provided for @ordersRemaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get ordersRemaining;

  /// No description provided for @ordersOrderTotal.
  ///
  /// In en, this message translates to:
  /// **'Order total'**
  String get ordersOrderTotal;

  /// No description provided for @ordersMarkOrdered.
  ///
  /// In en, this message translates to:
  /// **'Mark as ordered'**
  String get ordersMarkOrdered;

  /// No description provided for @ordersReceive.
  ///
  /// In en, this message translates to:
  /// **'Receive'**
  String get ordersReceive;

  /// No description provided for @ordersCancelOrder.
  ///
  /// In en, this message translates to:
  /// **'Cancel order'**
  String get ordersCancelOrder;

  /// No description provided for @ordersReceiveTitle.
  ///
  /// In en, this message translates to:
  /// **'Receive into stock'**
  String get ordersReceiveTitle;

  /// No description provided for @ordersSerials.
  ///
  /// In en, this message translates to:
  /// **'Serials'**
  String get ordersSerials;

  /// No description provided for @ordersAddSerial.
  ///
  /// In en, this message translates to:
  /// **'Add serial or IMEI'**
  String get ordersAddSerial;

  /// No description provided for @ordersSerialCountMismatch.
  ///
  /// In en, this message translates to:
  /// **'A serialized line needs exactly one serial per received unit.'**
  String get ordersSerialCountMismatch;

  /// No description provided for @ordersReceiveNote.
  ///
  /// In en, this message translates to:
  /// **'Receipt note'**
  String get ordersReceiveNote;

  /// No description provided for @ordersPostReceipt.
  ///
  /// In en, this message translates to:
  /// **'Post receipt'**
  String get ordersPostReceipt;

  /// No description provided for @ordersReceiptPosted.
  ///
  /// In en, this message translates to:
  /// **'Receipt posted'**
  String get ordersReceiptPosted;

  /// No description provided for @ordersNewReturn.
  ///
  /// In en, this message translates to:
  /// **'New return'**
  String get ordersNewReturn;

  /// No description provided for @ordersReturnReason.
  ///
  /// In en, this message translates to:
  /// **'Why are the goods going back?'**
  String get ordersReturnReason;

  /// No description provided for @ordersPostReturn.
  ///
  /// In en, this message translates to:
  /// **'Post return'**
  String get ordersPostReturn;

  /// No description provided for @ordersCancelReturn.
  ///
  /// In en, this message translates to:
  /// **'Cancel return'**
  String get ordersCancelReturn;

  /// No description provided for @ordersReturnPosted.
  ///
  /// In en, this message translates to:
  /// **'Return posted'**
  String get ordersReturnPosted;

  /// No description provided for @ordersDownloadPdf.
  ///
  /// In en, this message translates to:
  /// **'Download PDF'**
  String get ordersDownloadPdf;

  /// No description provided for @ordersPurchaseOrder.
  ///
  /// In en, this message translates to:
  /// **'Purchase order'**
  String get ordersPurchaseOrder;

  /// No description provided for @ordersSalesOrder.
  ///
  /// In en, this message translates to:
  /// **'Sales order'**
  String get ordersSalesOrder;

  /// No description provided for @ordersFilterStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get ordersFilterStatus;

  /// No description provided for @ordersCreatePurchaseTitle.
  ///
  /// In en, this message translates to:
  /// **'New purchase order'**
  String get ordersCreatePurchaseTitle;

  /// No description provided for @ordersCreateSaleTitle.
  ///
  /// In en, this message translates to:
  /// **'New sales order'**
  String get ordersCreateSaleTitle;

  /// No description provided for @ordersAddLine.
  ///
  /// In en, this message translates to:
  /// **'Add line'**
  String get ordersAddLine;

  /// No description provided for @ordersSelectSupplier.
  ///
  /// In en, this message translates to:
  /// **'Select a supplier'**
  String get ordersSelectSupplier;

  /// No description provided for @ordersSelectProduct.
  ///
  /// In en, this message translates to:
  /// **'Select a product'**
  String get ordersSelectProduct;

  /// No description provided for @ordersAtLeastOneLine.
  ///
  /// In en, this message translates to:
  /// **'Add at least one line.'**
  String get ordersAtLeastOneLine;

  /// No description provided for @ordersDuplicateProduct.
  ///
  /// In en, this message translates to:
  /// **'Each product may appear only once.'**
  String get ordersDuplicateProduct;

  /// No description provided for @ordersExpectedDate.
  ///
  /// In en, this message translates to:
  /// **'Expected date'**
  String get ordersExpectedDate;

  /// No description provided for @ordersStatusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get ordersStatusDraft;

  /// No description provided for @ordersStatusOrdered.
  ///
  /// In en, this message translates to:
  /// **'Ordered'**
  String get ordersStatusOrdered;

  /// No description provided for @ordersStatusPartiallyReceived.
  ///
  /// In en, this message translates to:
  /// **'Partially received'**
  String get ordersStatusPartiallyReceived;

  /// No description provided for @ordersStatusReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get ordersStatusReceived;

  /// No description provided for @ordersStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get ordersStatusCancelled;

  /// No description provided for @ordersStatusConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get ordersStatusConfirmed;

  /// No description provided for @ordersStatusFulfilled.
  ///
  /// In en, this message translates to:
  /// **'Fulfilled'**
  String get ordersStatusFulfilled;

  /// No description provided for @ordersStatusPosted.
  ///
  /// In en, this message translates to:
  /// **'Posted'**
  String get ordersStatusPosted;

  /// No description provided for @ordersConfirmOrder.
  ///
  /// In en, this message translates to:
  /// **'Confirm order'**
  String get ordersConfirmOrder;

  /// No description provided for @ordersFulfilOrder.
  ///
  /// In en, this message translates to:
  /// **'Fulfil order'**
  String get ordersFulfilOrder;

  /// No description provided for @ordersNoOrders.
  ///
  /// In en, this message translates to:
  /// **'No orders yet.'**
  String get ordersNoOrders;

  /// No description provided for @ordersLines.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No lines} =1{1 line} other{{count} lines}}'**
  String ordersLines(int count);

  /// No description provided for @ordersQuantityOrdered.
  ///
  /// In en, this message translates to:
  /// **'Ordered'**
  String get ordersQuantityOrdered;

  /// No description provided for @ordersQuantityReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get ordersQuantityReceived;

  /// No description provided for @ordersQuantityReturned.
  ///
  /// In en, this message translates to:
  /// **'Returned'**
  String get ordersQuantityReturned;

  /// No description provided for @ordersUnitCost.
  ///
  /// In en, this message translates to:
  /// **'Unit cost'**
  String get ordersUnitCost;

  /// No description provided for @ordersUnitPrice.
  ///
  /// In en, this message translates to:
  /// **'Unit price'**
  String get ordersUnitPrice;

  /// No description provided for @ordersReference.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get ordersReference;

  /// No description provided for @ordersNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get ordersNotes;

  /// No description provided for @ordersCustomer.
  ///
  /// In en, this message translates to:
  /// **'Customer name'**
  String get ordersCustomer;

  /// No description provided for @ordersPostReceiptHint.
  ///
  /// In en, this message translates to:
  /// **'Bulk lines post one ledger receipt per line. Serialized lines register one device per serial.'**
  String get ordersPostReceiptHint;

  /// No description provided for @stockTitle.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get stockTitle;

  /// No description provided for @stockMovements.
  ///
  /// In en, this message translates to:
  /// **'Movements'**
  String get stockMovements;

  /// No description provided for @stockTransfers.
  ///
  /// In en, this message translates to:
  /// **'Transfers'**
  String get stockTransfers;

  /// No description provided for @stockReservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get stockReservations;

  /// No description provided for @stockCounts.
  ///
  /// In en, this message translates to:
  /// **'Stock counts'**
  String get stockCounts;

  /// No description provided for @stockReconciliation.
  ///
  /// In en, this message translates to:
  /// **'Reconciliation'**
  String get stockReconciliation;

  /// No description provided for @stockPostMovement.
  ///
  /// In en, this message translates to:
  /// **'Post movement'**
  String get stockPostMovement;

  /// No description provided for @stockReceipt.
  ///
  /// In en, this message translates to:
  /// **'Receipt'**
  String get stockReceipt;

  /// No description provided for @stockIssue.
  ///
  /// In en, this message translates to:
  /// **'Issue'**
  String get stockIssue;

  /// No description provided for @stockAdjustment.
  ///
  /// In en, this message translates to:
  /// **'Adjustment'**
  String get stockAdjustment;

  /// No description provided for @stockSignedQuantity.
  ///
  /// In en, this message translates to:
  /// **'Signed quantity'**
  String get stockSignedQuantity;

  /// No description provided for @stockReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Adjustments require a reason.'**
  String get stockReasonRequired;

  /// No description provided for @stockPosted.
  ///
  /// In en, this message translates to:
  /// **'Movement posted'**
  String get stockPosted;

  /// No description provided for @stockMove.
  ///
  /// In en, this message translates to:
  /// **'Move stock'**
  String get stockMove;

  /// No description provided for @stockTransferTitle.
  ///
  /// In en, this message translates to:
  /// **'Transfer stock'**
  String get stockTransferTitle;

  /// No description provided for @stockSource.
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get stockSource;

  /// No description provided for @stockTarget.
  ///
  /// In en, this message translates to:
  /// **'Target'**
  String get stockTarget;

  /// No description provided for @stockReserve.
  ///
  /// In en, this message translates to:
  /// **'Reserve stock'**
  String get stockReserve;

  /// No description provided for @stockRelease.
  ///
  /// In en, this message translates to:
  /// **'Release'**
  String get stockRelease;

  /// No description provided for @stockReservationStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get stockReservationStatus;

  /// No description provided for @stockExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires'**
  String get stockExpires;

  /// No description provided for @stockNoReservations.
  ///
  /// In en, this message translates to:
  /// **'No reservations.'**
  String get stockNoReservations;

  /// No description provided for @stockReconcileTitle.
  ///
  /// In en, this message translates to:
  /// **'Stock reconciliation'**
  String get stockReconcileTitle;

  /// No description provided for @stockReconcileBody.
  ///
  /// In en, this message translates to:
  /// **'Compare the balance projection with the ledger sum. Repair rebuilds the projection without touching history.'**
  String get stockReconcileBody;

  /// No description provided for @stockBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get stockBalance;

  /// No description provided for @stockLedger.
  ///
  /// In en, this message translates to:
  /// **'Ledger'**
  String get stockLedger;

  /// No description provided for @stockDifference.
  ///
  /// In en, this message translates to:
  /// **'Difference'**
  String get stockDifference;

  /// No description provided for @stockRepair.
  ///
  /// In en, this message translates to:
  /// **'Repair projection'**
  String get stockRepair;

  /// No description provided for @stockDryRun.
  ///
  /// In en, this message translates to:
  /// **'Dry run'**
  String get stockDryRun;

  /// No description provided for @stockRepairApplied.
  ///
  /// In en, this message translates to:
  /// **'Projection repaired'**
  String get stockRepairApplied;

  /// No description provided for @stockBalanced.
  ///
  /// In en, this message translates to:
  /// **'Balance and ledger agree.'**
  String get stockBalanced;

  /// No description provided for @stockCountsTitle.
  ///
  /// In en, this message translates to:
  /// **'Stock counts'**
  String get stockCountsTitle;

  /// No description provided for @stockNewCount.
  ///
  /// In en, this message translates to:
  /// **'Start a count'**
  String get stockNewCount;

  /// No description provided for @stockResumeCount.
  ///
  /// In en, this message translates to:
  /// **'Resume count'**
  String get stockResumeCount;

  /// No description provided for @stockCountLines.
  ///
  /// In en, this message translates to:
  /// **'Counted lines'**
  String get stockCountLines;

  /// No description provided for @stockAddCountLine.
  ///
  /// In en, this message translates to:
  /// **'Add or increment a line'**
  String get stockAddCountLine;

  /// No description provided for @stockIncrement.
  ///
  /// In en, this message translates to:
  /// **'Increment'**
  String get stockIncrement;

  /// No description provided for @stockSetCount.
  ///
  /// In en, this message translates to:
  /// **'Set count'**
  String get stockSetCount;

  /// No description provided for @stockVariance.
  ///
  /// In en, this message translates to:
  /// **'Variance'**
  String get stockVariance;

  /// No description provided for @stockPostCount.
  ///
  /// In en, this message translates to:
  /// **'Post count'**
  String get stockPostCount;

  /// No description provided for @stockDiscardCount.
  ///
  /// In en, this message translates to:
  /// **'Discard count'**
  String get stockDiscardCount;

  /// No description provided for @stockCountPosted.
  ///
  /// In en, this message translates to:
  /// **'Count posted'**
  String get stockCountPosted;

  /// No description provided for @stockCountDiscarded.
  ///
  /// In en, this message translates to:
  /// **'Count discarded'**
  String get stockCountDiscarded;

  /// No description provided for @stockCountEmpty.
  ///
  /// In en, this message translates to:
  /// **'No lines counted yet.'**
  String get stockCountEmpty;

  /// No description provided for @stockSerializedNotCountable.
  ///
  /// In en, this message translates to:
  /// **'Serialized products are counted through devices, not quantity counts.'**
  String get stockSerializedNotCountable;

  /// No description provided for @stockOpenCountExists.
  ///
  /// In en, this message translates to:
  /// **'Only one count can be open per location.'**
  String get stockOpenCountExists;

  /// No description provided for @stockSelectCountLocation.
  ///
  /// In en, this message translates to:
  /// **'Choose the warehouse and location to count.'**
  String get stockSelectCountLocation;

  /// No description provided for @stockCountNote.
  ///
  /// In en, this message translates to:
  /// **'Count note'**
  String get stockCountNote;

  /// No description provided for @stockMovementType.
  ///
  /// In en, this message translates to:
  /// **'Movement type'**
  String get stockMovementType;

  /// No description provided for @stockNoMovements.
  ///
  /// In en, this message translates to:
  /// **'No movements in this window.'**
  String get stockNoMovements;

  /// No description provided for @stockReserveHint.
  ///
  /// In en, this message translates to:
  /// **'Reserving never consumes stock; available = on hand − active reservations.'**
  String get stockReserveHint;

  /// No description provided for @stockReservationReleased.
  ///
  /// In en, this message translates to:
  /// **'Reservation released'**
  String get stockReservationReleased;

  /// No description provided for @stockQuantityAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get stockQuantityAvailable;

  /// No description provided for @devicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get devicesTitle;

  /// No description provided for @devicesRegister.
  ///
  /// In en, this message translates to:
  /// **'Register device'**
  String get devicesRegister;

  /// No description provided for @devicesSerial.
  ///
  /// In en, this message translates to:
  /// **'Serial number'**
  String get devicesSerial;

  /// No description provided for @devicesImei.
  ///
  /// In en, this message translates to:
  /// **'IMEI'**
  String get devicesImei;

  /// No description provided for @devicesCondition.
  ///
  /// In en, this message translates to:
  /// **'Condition'**
  String get devicesCondition;

  /// No description provided for @devicesWarranty.
  ///
  /// In en, this message translates to:
  /// **'Warranty'**
  String get devicesWarranty;

  /// No description provided for @devicesWarrantyStart.
  ///
  /// In en, this message translates to:
  /// **'Warranty start'**
  String get devicesWarrantyStart;

  /// No description provided for @devicesWarrantyEnd.
  ///
  /// In en, this message translates to:
  /// **'Warranty end'**
  String get devicesWarrantyEnd;

  /// No description provided for @devicesSupplierRef.
  ///
  /// In en, this message translates to:
  /// **'Supplier reference'**
  String get devicesSupplierRef;

  /// No description provided for @devicesStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get devicesStatus;

  /// No description provided for @devicesEvents.
  ///
  /// In en, this message translates to:
  /// **'Events'**
  String get devicesEvents;

  /// No description provided for @devicesMove.
  ///
  /// In en, this message translates to:
  /// **'Move location'**
  String get devicesMove;

  /// No description provided for @devicesChangeStatus.
  ///
  /// In en, this message translates to:
  /// **'Change status'**
  String get devicesChangeStatus;

  /// No description provided for @devicesSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search serial, IMEI, SKU or product'**
  String get devicesSearchHint;

  /// No description provided for @devicesAllStatuses.
  ///
  /// In en, this message translates to:
  /// **'All statuses'**
  String get devicesAllStatuses;

  /// No description provided for @devicesRegisteredAt.
  ///
  /// In en, this message translates to:
  /// **'Received {date}'**
  String devicesRegisteredAt(String date);

  /// No description provided for @devicesNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get devicesNew;

  /// No description provided for @devicesUsed.
  ///
  /// In en, this message translates to:
  /// **'Used'**
  String get devicesUsed;

  /// No description provided for @devicesRefurbished.
  ///
  /// In en, this message translates to:
  /// **'Refurbished'**
  String get devicesRefurbished;

  /// No description provided for @devicesDamaged.
  ///
  /// In en, this message translates to:
  /// **'Damaged'**
  String get devicesDamaged;

  /// No description provided for @devicesDefective.
  ///
  /// In en, this message translates to:
  /// **'Defective'**
  String get devicesDefective;

  /// No description provided for @devicesRegisterTitle.
  ///
  /// In en, this message translates to:
  /// **'Register a serialized unit'**
  String get devicesRegisterTitle;

  /// No description provided for @devicesDeviceRegistered.
  ///
  /// In en, this message translates to:
  /// **'Device registered'**
  String get devicesDeviceRegistered;

  /// No description provided for @devicesEventHistory.
  ///
  /// In en, this message translates to:
  /// **'Event history'**
  String get devicesEventHistory;

  /// No description provided for @devicesNoEvents.
  ///
  /// In en, this message translates to:
  /// **'No events recorded.'**
  String get devicesNoEvents;

  /// No description provided for @devicesMoveTitle.
  ///
  /// In en, this message translates to:
  /// **'Move to another shelf'**
  String get devicesMoveTitle;

  /// No description provided for @devicesStatusChanged.
  ///
  /// In en, this message translates to:
  /// **'Device status updated'**
  String get devicesStatusChanged;

  /// No description provided for @devicesStatusInStock.
  ///
  /// In en, this message translates to:
  /// **'In stock'**
  String get devicesStatusInStock;

  /// No description provided for @devicesStatusReserved.
  ///
  /// In en, this message translates to:
  /// **'Reserved'**
  String get devicesStatusReserved;

  /// No description provided for @devicesStatusSold.
  ///
  /// In en, this message translates to:
  /// **'Sold'**
  String get devicesStatusSold;

  /// No description provided for @devicesStatusReturned.
  ///
  /// In en, this message translates to:
  /// **'Returned'**
  String get devicesStatusReturned;

  /// No description provided for @devicesStatusInRepair.
  ///
  /// In en, this message translates to:
  /// **'In repair'**
  String get devicesStatusInRepair;

  /// No description provided for @devicesStatusLost.
  ///
  /// In en, this message translates to:
  /// **'Lost'**
  String get devicesStatusLost;

  /// No description provided for @devicesStatusDisposed.
  ///
  /// In en, this message translates to:
  /// **'Disposed'**
  String get devicesStatusDisposed;

  /// No description provided for @devicesNoDevices.
  ///
  /// In en, this message translates to:
  /// **'No devices match this search.'**
  String get devicesNoDevices;

  /// No description provided for @suppliersTitle.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get suppliersTitle;

  /// No description provided for @suppliersNew.
  ///
  /// In en, this message translates to:
  /// **'New supplier'**
  String get suppliersNew;

  /// No description provided for @suppliersSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search suppliers'**
  String get suppliersSearchHint;

  /// No description provided for @suppliersActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get suppliersActive;

  /// No description provided for @suppliersInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get suppliersInactive;

  /// No description provided for @suppliersActivate.
  ///
  /// In en, this message translates to:
  /// **'Activate'**
  String get suppliersActivate;

  /// No description provided for @suppliersDeactivate.
  ///
  /// In en, this message translates to:
  /// **'Deactivate'**
  String get suppliersDeactivate;

  /// No description provided for @suppliersContact.
  ///
  /// In en, this message translates to:
  /// **'Contact name'**
  String get suppliersContact;

  /// No description provided for @suppliersTaxId.
  ///
  /// In en, this message translates to:
  /// **'Tax ID'**
  String get suppliersTaxId;

  /// No description provided for @suppliersCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get suppliersCity;

  /// No description provided for @suppliersCountry.
  ///
  /// In en, this message translates to:
  /// **'Country code'**
  String get suppliersCountry;

  /// No description provided for @suppliersAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get suppliersAddress;

  /// No description provided for @suppliersNoSuppliers.
  ///
  /// In en, this message translates to:
  /// **'No suppliers yet.'**
  String get suppliersNoSuppliers;

  /// No description provided for @suppliersSaved.
  ///
  /// In en, this message translates to:
  /// **'Supplier saved'**
  String get suppliersSaved;

  /// No description provided for @customersTitle.
  ///
  /// In en, this message translates to:
  /// **'Customers'**
  String get customersTitle;

  /// No description provided for @customersNew.
  ///
  /// In en, this message translates to:
  /// **'New customer'**
  String get customersNew;

  /// No description provided for @customersSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search customers'**
  String get customersSearchHint;

  /// No description provided for @customersActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get customersActive;

  /// No description provided for @customersInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get customersInactive;

  /// No description provided for @customersActivate.
  ///
  /// In en, this message translates to:
  /// **'Activate'**
  String get customersActivate;

  /// No description provided for @customersDeactivate.
  ///
  /// In en, this message translates to:
  /// **'Deactivate'**
  String get customersDeactivate;

  /// No description provided for @customersPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get customersPhone;

  /// No description provided for @customersNoCustomers.
  ///
  /// In en, this message translates to:
  /// **'No customers yet.'**
  String get customersNoCustomers;

  /// No description provided for @customersSaved.
  ///
  /// In en, this message translates to:
  /// **'Customer saved'**
  String get customersSaved;

  /// No description provided for @customersTaxId.
  ///
  /// In en, this message translates to:
  /// **'Tax ID'**
  String get customersTaxId;

  /// No description provided for @customersCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get customersCity;

  /// No description provided for @customersAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get customersAddress;

  /// No description provided for @reportsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get reportsTitle;

  /// No description provided for @reportsOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get reportsOverview;

  /// No description provided for @reportsLowStock.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get reportsLowStock;

  /// No description provided for @reportsSupplierPerformance.
  ///
  /// In en, this message translates to:
  /// **'Supplier performance'**
  String get reportsSupplierPerformance;

  /// No description provided for @reportsWindow.
  ///
  /// In en, this message translates to:
  /// **'Window'**
  String get reportsWindow;

  /// No description provided for @reportsPurchases.
  ///
  /// In en, this message translates to:
  /// **'Purchase value'**
  String get reportsPurchases;

  /// No description provided for @reportsSales.
  ///
  /// In en, this message translates to:
  /// **'Retail value'**
  String get reportsSales;

  /// No description provided for @reportsUnpriced.
  ///
  /// In en, this message translates to:
  /// **'{count} unpriced products'**
  String reportsUnpriced(int count);

  /// No description provided for @reportsMovements.
  ///
  /// In en, this message translates to:
  /// **'Movements'**
  String get reportsMovements;

  /// No description provided for @reportsReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get reportsReceived;

  /// No description provided for @reportsIssued.
  ///
  /// In en, this message translates to:
  /// **'Issued'**
  String get reportsIssued;

  /// No description provided for @reportsNet.
  ///
  /// In en, this message translates to:
  /// **'Net'**
  String get reportsNet;

  /// No description provided for @reportsWarehouses.
  ///
  /// In en, this message translates to:
  /// **'By warehouse'**
  String get reportsWarehouses;

  /// No description provided for @reportsExportStockLevels.
  ///
  /// In en, this message translates to:
  /// **'Export stock levels CSV'**
  String get reportsExportStockLevels;

  /// No description provided for @reportsExportMovements.
  ///
  /// In en, this message translates to:
  /// **'Export movements CSV'**
  String get reportsExportMovements;

  /// No description provided for @reportsExported.
  ///
  /// In en, this message translates to:
  /// **'Export ready'**
  String get reportsExported;

  /// No description provided for @reportsNoLowStock.
  ///
  /// In en, this message translates to:
  /// **'Nothing is below its reorder level.'**
  String get reportsNoLowStock;

  /// No description provided for @reportsProducts.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get reportsProducts;

  /// No description provided for @reportsAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get reportsAvailable;

  /// No description provided for @reportsShortfall.
  ///
  /// In en, this message translates to:
  /// **'Shortfall'**
  String get reportsShortfall;

  /// No description provided for @reportsOnTime.
  ///
  /// In en, this message translates to:
  /// **'On-time rate'**
  String get reportsOnTime;

  /// No description provided for @reportsAvgLeadTime.
  ///
  /// In en, this message translates to:
  /// **'Average lead time'**
  String get reportsAvgLeadTime;

  /// No description provided for @reportsReturnRate.
  ///
  /// In en, this message translates to:
  /// **'Return rate'**
  String get reportsReturnRate;

  /// No description provided for @reportsOrdersCreated.
  ///
  /// In en, this message translates to:
  /// **'Orders created'**
  String get reportsOrdersCreated;

  /// No description provided for @reportsOrdersReceived.
  ///
  /// In en, this message translates to:
  /// **'Orders received'**
  String get reportsOrdersReceived;

  /// No description provided for @reportsGeneratedAt.
  ///
  /// In en, this message translates to:
  /// **'Generated {time}'**
  String reportsGeneratedAt(String time);

  /// No description provided for @reportsNoData.
  ///
  /// In en, this message translates to:
  /// **'No data in this window.'**
  String get reportsNoData;

  /// No description provided for @reportsDays.
  ///
  /// In en, this message translates to:
  /// **'{count} days'**
  String reportsDays(int count);

  /// No description provided for @reportsSalesValue.
  ///
  /// In en, this message translates to:
  /// **'Sale value'**
  String get reportsSalesValue;

  /// No description provided for @reportsPurchaseValue.
  ///
  /// In en, this message translates to:
  /// **'Purchase value'**
  String get reportsPurchaseValue;

  /// No description provided for @reportsLowStockTitle.
  ///
  /// In en, this message translates to:
  /// **'Low stock'**
  String get reportsLowStockTitle;

  /// No description provided for @teamTitle.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get teamTitle;

  /// No description provided for @teamMembers.
  ///
  /// In en, this message translates to:
  /// **'Members'**
  String get teamMembers;

  /// No description provided for @teamInvitations.
  ///
  /// In en, this message translates to:
  /// **'Invitations'**
  String get teamInvitations;

  /// No description provided for @teamInvite.
  ///
  /// In en, this message translates to:
  /// **'Invite'**
  String get teamInvite;

  /// No description provided for @teamInviteTitle.
  ///
  /// In en, this message translates to:
  /// **'Invite a teammate'**
  String get teamInviteTitle;

  /// No description provided for @teamRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get teamRole;

  /// No description provided for @teamChangeRole.
  ///
  /// In en, this message translates to:
  /// **'Change role'**
  String get teamChangeRole;

  /// No description provided for @teamRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove from organization'**
  String get teamRemove;

  /// No description provided for @teamRemoveConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove {email} from this organization?'**
  String teamRemoveConfirm(String email);

  /// No description provided for @teamManagerViewerOnly.
  ///
  /// In en, this message translates to:
  /// **'Managers can invite viewers only.'**
  String get teamManagerViewerOnly;

  /// No description provided for @teamOwnerOnly.
  ///
  /// In en, this message translates to:
  /// **'Only owners can manage owner roles.'**
  String get teamOwnerOnly;

  /// No description provided for @teamNoMembers.
  ///
  /// In en, this message translates to:
  /// **'No members.'**
  String get teamNoMembers;

  /// No description provided for @teamPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get teamPending;

  /// No description provided for @teamAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get teamAccepted;

  /// No description provided for @teamExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get teamExpired;

  /// No description provided for @teamRevoked.
  ///
  /// In en, this message translates to:
  /// **'Revoked'**
  String get teamRevoked;

  /// No description provided for @teamRevoke.
  ///
  /// In en, this message translates to:
  /// **'Revoke'**
  String get teamRevoke;

  /// No description provided for @teamInvitesExpire.
  ///
  /// In en, this message translates to:
  /// **'Invitations expire after 14 days.'**
  String get teamInvitesExpire;

  /// No description provided for @teamInvitedBy.
  ///
  /// In en, this message translates to:
  /// **'Invited by {name}'**
  String teamInvitedBy(String name);

  /// No description provided for @teamInviteCreated.
  ///
  /// In en, this message translates to:
  /// **'Invitation created'**
  String get teamInviteCreated;

  /// No description provided for @teamRoleChanged.
  ///
  /// In en, this message translates to:
  /// **'Role updated'**
  String get teamRoleChanged;

  /// No description provided for @teamMemberRemoved.
  ///
  /// In en, this message translates to:
  /// **'Member removed'**
  String get teamMemberRemoved;

  /// No description provided for @teamInvitedEmail.
  ///
  /// In en, this message translates to:
  /// **'Email address'**
  String get teamInvitedEmail;

  /// No description provided for @teamAcceptInvitation.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get teamAcceptInvitation;

  /// No description provided for @teamInvitationAccepted.
  ///
  /// In en, this message translates to:
  /// **'Invitation accepted'**
  String get teamInvitationAccepted;

  /// No description provided for @teamPendingInvitations.
  ///
  /// In en, this message translates to:
  /// **'Pending invitations'**
  String get teamPendingInvitations;

  /// No description provided for @adminTitle.
  ///
  /// In en, this message translates to:
  /// **'Administration'**
  String get adminTitle;

  /// No description provided for @adminOrganizations.
  ///
  /// In en, this message translates to:
  /// **'Organizations'**
  String get adminOrganizations;

  /// No description provided for @adminAudit.
  ///
  /// In en, this message translates to:
  /// **'Operator activity'**
  String get adminAudit;

  /// No description provided for @adminNewOrganization.
  ///
  /// In en, this message translates to:
  /// **'New organization'**
  String get adminNewOrganization;

  /// No description provided for @adminNewOrganizationTitle.
  ///
  /// In en, this message translates to:
  /// **'Create an organization'**
  String get adminNewOrganizationTitle;

  /// No description provided for @adminOrgName.
  ///
  /// In en, this message translates to:
  /// **'Organization name'**
  String get adminOrgName;

  /// No description provided for @adminOrgSlug.
  ///
  /// In en, this message translates to:
  /// **'Slug'**
  String get adminOrgSlug;

  /// No description provided for @adminFirstMemberEmail.
  ///
  /// In en, this message translates to:
  /// **'First member email'**
  String get adminFirstMemberEmail;

  /// No description provided for @adminFirstMemberRole.
  ///
  /// In en, this message translates to:
  /// **'First member role'**
  String get adminFirstMemberRole;

  /// No description provided for @adminCreateOrg.
  ///
  /// In en, this message translates to:
  /// **'Create organization'**
  String get adminCreateOrg;

  /// No description provided for @adminMembers.
  ///
  /// In en, this message translates to:
  /// **'{count} members'**
  String adminMembers(int count);

  /// No description provided for @adminPendingInvites.
  ///
  /// In en, this message translates to:
  /// **'{count} pending'**
  String adminPendingInvites(int count);

  /// No description provided for @adminNoOrgs.
  ///
  /// In en, this message translates to:
  /// **'No organizations.'**
  String get adminNoOrgs;

  /// No description provided for @adminNoAudit.
  ///
  /// In en, this message translates to:
  /// **'No operator activity.'**
  String get adminNoAudit;

  /// No description provided for @adminAction.
  ///
  /// In en, this message translates to:
  /// **'Action'**
  String get adminAction;

  /// No description provided for @adminActor.
  ///
  /// In en, this message translates to:
  /// **'Actor'**
  String get adminActor;

  /// No description provided for @adminTarget.
  ///
  /// In en, this message translates to:
  /// **'Target'**
  String get adminTarget;

  /// No description provided for @adminOrganizationCreated.
  ///
  /// In en, this message translates to:
  /// **'Organization created'**
  String get adminOrganizationCreated;

  /// No description provided for @adminManageTeam.
  ///
  /// In en, this message translates to:
  /// **'Manage team'**
  String get adminManageTeam;

  /// No description provided for @adminIdentityOnly.
  ///
  /// In en, this message translates to:
  /// **'Platform administration covers identity rows only; tenant stock and sales stay behind membership.'**
  String get adminIdentityOnly;

  /// No description provided for @brandingTitle.
  ///
  /// In en, this message translates to:
  /// **'Branding'**
  String get brandingTitle;

  /// No description provided for @brandingUpload.
  ///
  /// In en, this message translates to:
  /// **'Upload logo'**
  String get brandingUpload;

  /// No description provided for @brandingReplace.
  ///
  /// In en, this message translates to:
  /// **'Replace logo'**
  String get brandingReplace;

  /// No description provided for @brandingRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove logo'**
  String get brandingRemove;

  /// No description provided for @brandingRemoveConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove the organization logo?'**
  String get brandingRemoveConfirm;

  /// No description provided for @brandingLogo.
  ///
  /// In en, this message translates to:
  /// **'Organization logo'**
  String get brandingLogo;

  /// No description provided for @brandingHint.
  ///
  /// In en, this message translates to:
  /// **'PNG or JPEG, up to 400 KB. The mark appears in the workspace and on generated documents.'**
  String get brandingHint;

  /// No description provided for @brandingTooLarge.
  ///
  /// In en, this message translates to:
  /// **'The image must be 400 KB or smaller.'**
  String get brandingTooLarge;

  /// No description provided for @brandingUploaded.
  ///
  /// In en, this message translates to:
  /// **'Logo updated'**
  String get brandingUploaded;

  /// No description provided for @brandingRemoved.
  ///
  /// In en, this message translates to:
  /// **'Logo removed'**
  String get brandingRemoved;

  /// No description provided for @brandingUnsupported.
  ///
  /// In en, this message translates to:
  /// **'Choose a PNG or JPEG image.'**
  String get brandingUnsupported;

  /// No description provided for @documentsLabels.
  ///
  /// In en, this message translates to:
  /// **'Labels'**
  String get documentsLabels;

  /// No description provided for @documentsSelectCopies.
  ///
  /// In en, this message translates to:
  /// **'Copies'**
  String get documentsSelectCopies;

  /// No description provided for @documentsLabelHint.
  ///
  /// In en, this message translates to:
  /// **'Labels print as an A4 sheet. Choose 1 to 20 copies per item.'**
  String get documentsLabelHint;

  /// No description provided for @documentsDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Document ready'**
  String get documentsDownloaded;

  /// No description provided for @documentsShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get documentsShare;

  /// No description provided for @documentsOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get documentsOpen;

  /// No description provided for @documentsNoApp.
  ///
  /// In en, this message translates to:
  /// **'No app on this phone can open this file. It can still be shared.'**
  String get documentsNoApp;

  /// No description provided for @moreTitle.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get moreTitle;

  /// No description provided for @moreOperations.
  ///
  /// In en, this message translates to:
  /// **'Operations'**
  String get moreOperations;

  /// No description provided for @moreDirectory.
  ///
  /// In en, this message translates to:
  /// **'Directory'**
  String get moreDirectory;

  /// No description provided for @moreOrganization.
  ///
  /// In en, this message translates to:
  /// **'Organization'**
  String get moreOrganization;

  /// No description provided for @moreAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get moreAccount;

  /// No description provided for @moreWarehouses.
  ///
  /// In en, this message translates to:
  /// **'Warehouses'**
  String get moreWarehouses;

  /// No description provided for @moreCatalogSettings.
  ///
  /// In en, this message translates to:
  /// **'Catalog settings'**
  String get moreCatalogSettings;

  /// No description provided for @moreReports.
  ///
  /// In en, this message translates to:
  /// **'Reports'**
  String get moreReports;

  /// No description provided for @moreAdmin.
  ///
  /// In en, this message translates to:
  /// **'Platform administration'**
  String get moreAdmin;

  /// No description provided for @moreStockCounts.
  ///
  /// In en, this message translates to:
  /// **'Stock counts'**
  String get moreStockCounts;

  /// No description provided for @moreMovements.
  ///
  /// In en, this message translates to:
  /// **'Stock movements'**
  String get moreMovements;

  /// No description provided for @moreTransfers.
  ///
  /// In en, this message translates to:
  /// **'Stock transfers'**
  String get moreTransfers;

  /// No description provided for @moreReservations.
  ///
  /// In en, this message translates to:
  /// **'Reservations'**
  String get moreReservations;

  /// No description provided for @moreReconciliation.
  ///
  /// In en, this message translates to:
  /// **'Reconciliation'**
  String get moreReconciliation;

  /// No description provided for @moreDevices.
  ///
  /// In en, this message translates to:
  /// **'Devices'**
  String get moreDevices;

  /// No description provided for @moreSuppliers.
  ///
  /// In en, this message translates to:
  /// **'Suppliers'**
  String get moreSuppliers;

  /// No description provided for @moreCustomers.
  ///
  /// In en, this message translates to:
  /// **'Customers'**
  String get moreCustomers;

  /// No description provided for @morePurchaseOrders.
  ///
  /// In en, this message translates to:
  /// **'Purchase orders'**
  String get morePurchaseOrders;

  /// No description provided for @moreSalesOrders.
  ///
  /// In en, this message translates to:
  /// **'Sales orders'**
  String get moreSalesOrders;

  /// No description provided for @moreBranding.
  ///
  /// In en, this message translates to:
  /// **'Branding'**
  String get moreBranding;

  /// No description provided for @moreTeam.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get moreTeam;

  /// No description provided for @moreLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get moreLanguage;

  /// No description provided for @moreSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get moreSignOut;

  /// No description provided for @moreNoResults.
  ///
  /// In en, this message translates to:
  /// **'No workflow matches this search.'**
  String get moreNoResults;

  /// No description provided for @moreSignedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {email}'**
  String moreSignedInAs(String email);

  /// No description provided for @moreInventory.
  ///
  /// In en, this message translates to:
  /// **'Inventory'**
  String get moreInventory;

  /// No description provided for @moreStockLevels.
  ///
  /// In en, this message translates to:
  /// **'Stock levels'**
  String get moreStockLevels;

  /// No description provided for @moreReturns.
  ///
  /// In en, this message translates to:
  /// **'Returns'**
  String get moreReturns;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'The API could not be reached. Check the connection and try again.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In en, this message translates to:
  /// **'The request took too long. Try again.'**
  String get errorTimeout;

  /// No description provided for @errorUnauthorized.
  ///
  /// In en, this message translates to:
  /// **'Your session is no longer valid. Sign in again.'**
  String get errorUnauthorized;

  /// No description provided for @errorForbidden.
  ///
  /// In en, this message translates to:
  /// **'Your role does not allow this action. The server refuses it.'**
  String get errorForbidden;

  /// No description provided for @errorNotFound.
  ///
  /// In en, this message translates to:
  /// **'This item was not found, or it belongs to another organization.'**
  String get errorNotFound;

  /// No description provided for @errorConflict.
  ///
  /// In en, this message translates to:
  /// **'This operation conflicts with the current data. Refresh and try again.'**
  String get errorConflict;

  /// No description provided for @errorValidation.
  ///
  /// In en, this message translates to:
  /// **'Check the highlighted fields.'**
  String get errorValidation;

  /// No description provided for @errorRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Try again in {seconds} seconds.'**
  String errorRateLimited(int seconds);

  /// No description provided for @errorServer.
  ///
  /// In en, this message translates to:
  /// **'The server could not complete the request.'**
  String get errorServer;

  /// No description provided for @errorUnknown.
  ///
  /// In en, this message translates to:
  /// **'Something unexpected happened.'**
  String get errorUnknown;

  /// No description provided for @errorRequestId.
  ///
  /// In en, this message translates to:
  /// **'Support reference: {requestId}'**
  String errorRequestId(String requestId);

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Session expired'**
  String get errorSessionExpired;

  /// No description provided for @errorIdempotency.
  ///
  /// In en, this message translates to:
  /// **'This request was already posted with different data. Review it and try again.'**
  String get errorIdempotency;

  /// No description provided for @errorInsufficientStock.
  ///
  /// In en, this message translates to:
  /// **'Not enough stock available for this operation.'**
  String get errorInsufficientStock;

  /// No description provided for @errorServerEnforced.
  ///
  /// In en, this message translates to:
  /// **'The server is the authority for permissions, stock and totals.'**
  String get errorServerEnforced;

  /// No description provided for @errorServerMessage.
  ///
  /// In en, this message translates to:
  /// **'Server message'**
  String get errorServerMessage;

  /// No description provided for @errorPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Permission denied'**
  String get errorPermissionDenied;

  /// No description provided for @errorCameraRequired.
  ///
  /// In en, this message translates to:
  /// **'Camera permission is required to scan.'**
  String get errorCameraRequired;

  /// Button that fetches the next page of a list
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get commonLoadMore;

  /// No description provided for @moreInvoices.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get moreInvoices;

  /// No description provided for @stockReservationActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get stockReservationActive;

  /// No description provided for @stockReservationReleasedStatus.
  ///
  /// In en, this message translates to:
  /// **'Released'**
  String get stockReservationReleasedStatus;

  /// No description provided for @stockReservationFulfilled.
  ///
  /// In en, this message translates to:
  /// **'Fulfilled'**
  String get stockReservationFulfilled;

  /// No description provided for @stockReservationExpiredStatus.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get stockReservationExpiredStatus;

  /// No description provided for @warehousesNew.
  ///
  /// In en, this message translates to:
  /// **'New warehouse'**
  String get warehousesNew;

  /// No description provided for @warehousesCode.
  ///
  /// In en, this message translates to:
  /// **'Code'**
  String get warehousesCode;

  /// No description provided for @warehousesCity.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get warehousesCity;

  /// No description provided for @warehousesLocations.
  ///
  /// In en, this message translates to:
  /// **'Locations'**
  String get warehousesLocations;

  /// No description provided for @warehousesAddLocation.
  ///
  /// In en, this message translates to:
  /// **'Add location'**
  String get warehousesAddLocation;

  /// No description provided for @warehousesLocationCode.
  ///
  /// In en, this message translates to:
  /// **'Location code'**
  String get warehousesLocationCode;

  /// No description provided for @warehousesLocationName.
  ///
  /// In en, this message translates to:
  /// **'Location name'**
  String get warehousesLocationName;

  /// No description provided for @warehousesSaved.
  ///
  /// In en, this message translates to:
  /// **'Warehouse saved'**
  String get warehousesSaved;

  /// No description provided for @catalogNewCategory.
  ///
  /// In en, this message translates to:
  /// **'New category'**
  String get catalogNewCategory;

  /// No description provided for @catalogNewBrand.
  ///
  /// In en, this message translates to:
  /// **'New brand'**
  String get catalogNewBrand;

  /// No description provided for @stockSameLocation.
  ///
  /// In en, this message translates to:
  /// **'Choose two different locations'**
  String get stockSameLocation;

  /// No description provided for @stockTransferred.
  ///
  /// In en, this message translates to:
  /// **'Stock moved'**
  String get stockTransferred;

  /// No description provided for @languageSystem.
  ///
  /// In en, this message translates to:
  /// **'System default'**
  String get languageSystem;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageFrench.
  ///
  /// In en, this message translates to:
  /// **'Français'**
  String get languageFrench;

  /// No description provided for @languageArabic.
  ///
  /// In en, this message translates to:
  /// **'العربية'**
  String get languageArabic;

  /// No description provided for @moreConnection.
  ///
  /// In en, this message translates to:
  /// **'API connection'**
  String get moreConnection;

  /// No description provided for @connectionTitle.
  ///
  /// In en, this message translates to:
  /// **'API connection'**
  String get connectionTitle;

  /// No description provided for @connectionIntro.
  ///
  /// In en, this message translates to:
  /// **'The app sends every request to this address. It is stored on this device only; your account and data do not change.'**
  String get connectionIntro;

  /// No description provided for @connectionApiLabel.
  ///
  /// In en, this message translates to:
  /// **'API address'**
  String get connectionApiLabel;

  /// No description provided for @connectionHint.
  ///
  /// In en, this message translates to:
  /// **'https://nexora-web-service.onrender.com/api/v1'**
  String get connectionHint;

  /// No description provided for @connectionBuiltIn.
  ///
  /// In en, this message translates to:
  /// **'Built-in address: {url}'**
  String connectionBuiltIn(String url);

  /// No description provided for @connectionCustom.
  ///
  /// In en, this message translates to:
  /// **'Custom address on this device'**
  String get connectionCustom;

  /// No description provided for @connectionNoBuiltIn.
  ///
  /// In en, this message translates to:
  /// **'This build has no built-in address.'**
  String get connectionNoBuiltIn;

  /// No description provided for @connectionTest.
  ///
  /// In en, this message translates to:
  /// **'Test'**
  String get connectionTest;

  /// No description provided for @connectionTesting.
  ///
  /// In en, this message translates to:
  /// **'Testing…'**
  String get connectionTesting;

  /// No description provided for @connectionTestOk.
  ///
  /// In en, this message translates to:
  /// **'Reachable, answered in {milliseconds} ms.'**
  String connectionTestOk(int milliseconds);

  /// No description provided for @connectionTestFailed.
  ///
  /// In en, this message translates to:
  /// **'No answer: {message}'**
  String connectionTestFailed(String message);

  /// No description provided for @connectionInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter an http(s) address with a host, such as https://nexora-web-service.onrender.com/api/v1.'**
  String get connectionInvalid;

  /// No description provided for @connectionSaved.
  ///
  /// In en, this message translates to:
  /// **'API address saved.'**
  String get connectionSaved;

  /// No description provided for @connectionReset.
  ///
  /// In en, this message translates to:
  /// **'Use the built-in address'**
  String get connectionReset;

  /// No description provided for @connectionWaking.
  ///
  /// In en, this message translates to:
  /// **'A free Render instance can take up to a minute to wake on the first call.'**
  String get connectionWaking;

  /// No description provided for @errorApiNotConfigured.
  ///
  /// In en, this message translates to:
  /// **'No API address is set. Open API connection settings on this device.'**
  String get errorApiNotConfigured;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
