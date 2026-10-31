export const warehouses = {
  'warehouses.title': 'Warehouses',
  'warehouses.description':
    'Physical sites and the storage locations stock will be counted against.',
  'warehouses.addWarehouse': 'Add warehouse',
  'warehouses.viewerReadOnly':
    'Your viewer role is read-only. Owners, admins and managers can change warehouses.',
  'warehouses.loadFailed': 'Warehouses failed to load.',
  'warehouses.loading': 'Loading warehouses',
  'warehouses.emptyTitle': 'No warehouses yet',
  'warehouses.emptyCreateDescription':
    'Create the first physical site, then add its aisles or shelves as storage locations.',
  'warehouses.emptyViewerDescription': 'An owner, admin or manager can create the first warehouse.',
  'warehouses.inactive': 'Inactive',
  'warehouses.noAddress': 'No address recorded',
  'warehouses.storageLocations': 'Storage locations',
  'warehouses.noLocationsYet': 'No storage locations yet. Stock will need one when receiving.',
  'warehouseForms.warehouseTitle': 'Add warehouse',
  'warehouseForms.warehouseDescription':
    'Warehouse codes are unique within the organization and stored in uppercase.',
  'warehouseForms.code': 'Code',
  'warehouseForms.city': 'City',
  'warehouseForms.country': 'Country',
  'warehouseForms.address': 'Address',
  'warehouseForms.createWarehouse': 'Create warehouse',
  'warehouseForms.warehouseCreateFailed': 'The warehouse could not be created.',
  'warehouseForms.codeInvalid': 'Use 2 to 16 letters, digits or hyphens',
  'warehouseForms.nameRequired': 'Enter a warehouse name',
  'warehouseForms.countryCodeInvalid': 'Use a two-letter code',
  'warehouseForms.locationTitle': 'Add storage location',
  'warehouseForms.locationDescription': '{warehouseName} · codes are unique inside this warehouse.',
  'warehouseForms.locationNameRequired': 'Enter a location name',
  'warehouseForms.locationCodeInvalid': 'Use 1 to 24 letters, digits or hyphens',
  'warehouseForms.createLocation': 'Create location',
  'warehouseForms.locationCreateFailed': 'The storage location could not be created.',
} as const;

export type WarehousesMessages = Record<keyof typeof warehouses, string>;
