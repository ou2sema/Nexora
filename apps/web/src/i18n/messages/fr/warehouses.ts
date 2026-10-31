import type { WarehousesMessages } from '../en/warehouses';

export const warehouses: WarehousesMessages = {
  'warehouses.title': 'Entrepôts',
  'warehouses.description':
    'Sites physiques et emplacements de stockage utilisés pour le comptage du stock.',
  'warehouses.addWarehouse': 'Ajouter un entrepôt',
  'warehouses.viewerReadOnly':
    'Votre rôle de lecteur est en lecture seule. Les propriétaires, administrateurs et gestionnaires peuvent modifier les entrepôts.',
  'warehouses.loadFailed': 'Le chargement des entrepôts a échoué.',
  'warehouses.loading': 'Chargement des entrepôts',
  'warehouses.emptyTitle': 'Aucun entrepôt pour le moment',
  'warehouses.emptyCreateDescription':
    'Créez le premier site physique, puis ajoutez ses allées ou étagères comme emplacements de stockage.',
  'warehouses.emptyViewerDescription':
    'Un propriétaire, un administrateur ou un gestionnaire peut créer le premier entrepôt.',
  'warehouses.inactive': 'Inactif',
  'warehouses.noAddress': 'Aucune adresse enregistrée',
  'warehouses.storageLocations': 'Emplacements de stockage',
  'warehouses.noLocationsYet':
    'Aucun emplacement de stockage pour le moment. Le stock en aura besoin lors de la réception.',
  'warehouseForms.warehouseTitle': 'Ajouter un entrepôt',
  'warehouseForms.warehouseDescription':
    'Les codes d’entrepôt sont uniques au sein de l’organisation et enregistrés en majuscules.',
  'warehouseForms.code': 'Code',
  'warehouseForms.city': 'Ville',
  'warehouseForms.country': 'Pays',
  'warehouseForms.address': 'Adresse',
  'warehouseForms.createWarehouse': 'Créer l’entrepôt',
  'warehouseForms.warehouseCreateFailed': 'L’entrepôt n’a pas pu être créé.',
  'warehouseForms.codeInvalid': 'Utilisez de 2 à 16 lettres, chiffres ou traits d’union',
  'warehouseForms.nameRequired': 'Saisissez un nom d’entrepôt',
  'warehouseForms.countryCodeInvalid': 'Utilisez un code à deux lettres',
  'warehouseForms.locationTitle': 'Ajouter un emplacement de stockage',
  'warehouseForms.locationDescription':
    '{warehouseName} · les codes sont uniques dans cet entrepôt.',
  'warehouseForms.locationNameRequired': 'Saisissez un nom d’emplacement',
  'warehouseForms.locationCodeInvalid': 'Utilisez de 1 à 24 lettres, chiffres ou traits d’union',
  'warehouseForms.createLocation': 'Créer l’emplacement',
  'warehouseForms.locationCreateFailed': 'L’emplacement de stockage n’a pas pu être créé.',
};
