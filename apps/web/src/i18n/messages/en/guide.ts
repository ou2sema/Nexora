export const guide = {
  'guide.title': 'User guide',
  'guide.description': 'What each screen is for, how to use it, and what to watch out for.',
  'guide.intro':
    'Nexora keeps one record per organization. Every quantity you see is the result of movements that were actually posted, and every document is printed from that same record — nothing in the application changes stock by hand.',
  'guide.toc': 'In this guide',
  'guide.howTo': 'How to use it',
  'guide.watchOut': 'What to watch out for',
  'guide.openScreen': 'Open',

  'guide.signin.title': 'Sign in and choose your organization',
  'guide.signin.purpose':
    'Signing in opens your organization’s workspace. The organization switcher in the top bar is where you change tenant, and everything on screen belongs to that organization and to nobody else.',
  'guide.signin.step1':
    'Enter the e-mail address and the password your owner gave you, then pick the organization in the top bar.',
  'guide.signin.step2':
    'Pick your language in the same bar — English, French or Arabic. The choice is kept on this device, and the whole interface follows it, including the documents you print.',
  'guide.signin.step3':
    'If no organization appears, you have not been invited yet: ask the owner of that organization to invite your e-mail address.',
  'guide.signin.watch':
    'Your password is only ever sent to the sign-in form. No screen lets you read or change another organization’s products, stock or documents.',

  'guide.dashboard.title': 'Read the dashboard',
  'guide.dashboard.purpose':
    'The dashboard is the daily check: what is on hand, what moved recently, and what needs attention now.',
  'guide.dashboard.step1':
    'The counters come from the ledger — units received in, units issued out, and what is on hand at this moment.',
  'guide.dashboard.step2':
    'The bell and the low-stock card list the products at or below their reorder threshold, and the threshold itself is edited from that card.',
  'guide.dashboard.step3':
    'Recent movements are the audit trail: each row says why a quantity changed and which document or order caused it.',
  'guide.dashboard.step4':
    'The page refreshes on its own every 30 seconds, and it updates the moment another operator posts something.',
  'guide.dashboard.watch':
    'A bell that reads “none” straight after a failed load means the count did not arrive. Reload the page rather than trusting the zero.',

  'guide.sale.title': 'Sell at the counter',
  'guide.sale.purpose':
    'The sale screen turns a basket into a numbered commercial invoice in one step, and takes the stock out at the same time.',
  'guide.sale.step1':
    'Scan or search each product. A hardware scanner behaves like a keyboard: the code arrives without a click, a short beep confirms the read, and a confirmation names the product and asks how many units go in the basket.',
  'guide.sale.step2':
    'Open the review and name the buyer — a walk-in sale, or a customer you pick or create — then check the depot and the lines.',
  'guide.sale.step3':
    'Record the payment. You can take part of it now and leave the rest on account.',
  'guide.sale.step4':
    'Confirm the sale there. The invoice number (FI-2026-0001) is given by the system, counted per organization and year.',
  'guide.sale.step5':
    'Download the invoice, and the goods issue note as well when serialized devices left the depot.',
  'guide.sale.watch':
    'An issued invoice is final: there is no edit and no cancel, so a mistake becomes a return or a new invoice. Every amount is computed by the database, and a sale that asks for more than the stock on hand is refused instead of going negative.',

  'guide.scan.title': 'Scan: receive and count',
  'guide.scan.purpose':
    'The scanning console is where physical work is recorded: receiving a purchase order, counting a shelf, and printing labels.',
  'guide.scan.step1':
    'Use the camera or the field. Nexora tries the code as a device serial or IMEI first, then as a barcode, then as a product SKU, then as an internal code.',
  'guide.scan.step2':
    'To receive, choose the purchase order line, confirm the quantity and post it — the receipt becomes a movement into that location.',
  'guide.scan.step3':
    'To count, start a count on a location, enter what you actually see, then post it. Only the differences become movements.',
  'guide.scan.step4':
    'Labels print from the same screen: a product label carries its barcode, a device label carries its serial.',
  'guide.scan.watch':
    'The same code scanned twice within about a second is ignored on purpose, so a scanner that sends the code twice does not double the stock. A count never sets a quantity — it posts the difference it found.',

  'guide.stock.title': 'Stock, movements and reservations',
  'guide.stock.purpose':
    'These four screens show the same ledger from different angles; none of them edits it.',
  'guide.stock.step1':
    'Stock levels: how many units of each product sit in each warehouse and location.',
  'guide.stock.step2':
    'Movements: the whole history, with the reason for each change — receipt, issue, sale, count — and the document behind it.',
  'guide.stock.step3':
    'Reservations: units a confirmed outgoing order has already set aside, so they cannot be sold twice.',
  'guide.stock.step4':
    'Reconciliation: what the balances say against what the movements add up to. A healthy organization shows no drift.',
  'guide.stock.watch':
    'There is no screen where you type a new stock quantity. If a number looks wrong, the explanation is in the movements list, and reconciliation points at the same row.',

  'guide.orders.title': 'Outgoing orders and purchase orders',
  'guide.orders.purpose':
    'The order screens plan the work; the counter and the scanning console are where it actually happens.',
  'guide.orders.step1':
    'Outgoing orders go draft → confirmed → fulfilled. Confirming reserves the units, fulfilling issues them.',
  'guide.orders.step2': 'Cancelling a confirmed order releases what it had reserved.',
  'guide.orders.step3':
    'Purchase orders go draft → ordered, then received line by line in the scanning console; a partly received order stays open until every line is in.',
  'guide.orders.step4':
    'Returns close the loop: a purchase return sends units back to the supplier, a sales return puts them back on the shelf.',
  'guide.orders.watch':
    'A product tracked by serial cannot be ordered by quantity — each unit is scanned individually. Posting more than what was received or fulfilled is refused, not quietly cut down.',

  'guide.documents.title': 'Printed documents (French, Arabic, English)',
  'guide.documents.purpose':
    'Every document is printed at the moment you download it, from the record the screen is showing, in the language your interface is in.',
  'guide.documents.step1':
    'Invoices, goods issue notes, purchase orders and return notes print on A4 with your organization’s mark.',
  'guide.documents.step2':
    'Switch the interface language and the next download switches with it — the same invoice exists in French and in Arabic.',
  'guide.documents.step3':
    'The invoice carries the fiscal totals: net, tax, total, paid and remaining. The issue note carries quantities and serial numbers only and says on its face that it is not a fiscal document.',
  'guide.documents.step4':
    'Product and device label sheets print from the scanning console, in the same three languages.',
  'guide.documents.watch':
    'The seller’s address and tax number are not printed yet — that is a decision waiting to be made, not something you can fix from a screen. A document always matches the record at the moment it is downloaded, so print it when you hand it over.',

  'guide.roles.title': 'Roles, and what this guide does not cover',
  'guide.roles.purpose':
    'What you are allowed to press depends on your role, and the rule is enforced on the server, not only in the interface.',
  'guide.roles.step1':
    'Owner: everything, including the team, the invitations and the organization’s mark.',
  'guide.roles.step2':
    'Admin and manager: post sales, receipts, counts and orders. Managers may invite viewers only.',
  'guide.roles.step3': 'Viewer: read every screen and download every document, change nothing.',
  'guide.roles.step4':
    'Administration is the screen for whoever runs the deployment itself, not for daily stock work.',
  'guide.roles.watch':
    'A button you can see but cannot use is the server refusing the action, not a broken screen. Team changes, invitations and the organization logo belong to the owner.',

  'guide.rules.title': 'Rules worth remembering',
  'guide.rules.purpose':
    'Six habits of the application that explain most of what it does — and most of what it refuses to do.',
  'guide.rules.step1':
    'Money is stored in millimes and printed with three decimals: 1.000 TND is one dinar.',
  'guide.rules.step2':
    'Times are recorded in UTC and shown to you in your own date and time format.',
  'guide.rules.step3':
    'Pressing a button twice is safe: the same action sent twice is recognised and applied once.',
  'guide.rules.step4':
    'Stock is never a number you set. It is what the posted movements add up to, and it always can be traced back to them.',
  'guide.rules.step5':
    'Products, quantities and documents of one organization are invisible to every other organization.',
  'guide.rules.step6':
    'Documents are printed on demand rather than filed away, so what you download always matches the record of that second.',
} as const;

export type GuideMessages = Record<keyof typeof guide, string>;
