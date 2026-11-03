export const customers = {
  'customer.newTitle': 'New customer',
  'customer.editTitle': 'Edit customer',
  'customer.save.failed': 'The customer could not be saved.',

  'customer.form.description':
    'The identification the invoice prints. Purchase history, credit limits and balances are not kept here.',
  'customer.form.name': 'Name',
  'customer.form.nameRequired': 'Enter the name the invoice should carry.',
  'customer.form.email': 'Email',
  'customer.form.invalidEmail': 'Enter a valid email address, or leave it empty.',
  'customer.form.phone': 'Phone',
  'customer.form.address': 'Address',
  'customer.form.city': 'City',
  'customer.form.country': 'Country',
  'customer.form.invalidCountry': 'Use a two-letter country code.',
  'customer.form.taxId': 'Matricule fiscal',
  'customer.form.fiscalNote':
    'Name, matricule and address are copied onto each invoice at the moment of sale, so a later edit never rewrites a document already issued.',
  'customer.form.save': 'Save customer',
  'customer.form.create': 'Create customer',

  'customers.title': 'Customers',
  'customers.description':
    'The directory the counter bills from. A walk-in buyer can still be named on the sale without a record.',
  'customers.newCustomer': 'New customer',
  'customers.viewerReadOnly':
    'Your viewer role is read-only. Owners, admins and managers maintain the customer directory.',
  'customers.searchLabel': 'Search customers',
  'customers.searchPlaceholder': 'Name, email, phone or matricule',
  'customers.filterLabel': 'Filter by status',
  'customers.allCustomers': 'All customers',
  'customers.active': 'Active',
  'customers.inactive': 'Inactive',
  'customers.loading': 'Loading customers',
  'customers.loadFailed': 'Customers failed to load.',
  'customers.activationFailed': 'The customer status could not be changed.',
  'customers.emptyNone': 'No customers yet',
  'customers.emptyMatching': 'No matching customer',
  'customers.emptyMatchingDescription':
    'Adjust the search or the status filter to see more results.',
  'customers.emptyCreateDescription':
    'Add the buyers you invoice repeatedly; a one-off name can be typed on the sale itself.',
  'customers.emptyViewerDescription': 'An owner, admin or manager can add the first customer.',
  'customers.tableCaption': 'Customer directory',
  'customers.columns.customer': 'Customer',
  'customers.columns.contact': 'Contact',
  'customers.columns.since': 'Known since',
  'customers.taxId': 'Matricule',
  'customers.deactivate': 'Deactivate',
  'customers.reactivate': 'Reactivate',
} as const;

export type CustomerMessages = Record<keyof typeof customers, string>;
