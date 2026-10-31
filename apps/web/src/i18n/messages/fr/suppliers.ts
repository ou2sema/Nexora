import type { SuppliersMessages } from '../en/suppliers';

export const suppliers: SuppliersMessages = {
  'suppliers.title': 'Fournisseurs',
  'suppliers.description':
    'Répertoire des fournisseurs utilisé par les bons de commande. Les noms sont uniques par organisation.',
  'suppliers.newSupplier': 'Nouveau fournisseur',
  'suppliers.viewerReadOnly':
    'Votre rôle de lecteur est en lecture seule. Les propriétaires, administrateurs et gestionnaires gèrent les fournisseurs.',
  'suppliers.activationFailed': 'La modification de l’activation a échoué.',
  'suppliers.searchLabel': 'Rechercher des fournisseurs',
  'suppliers.searchPlaceholder': 'Rechercher par nom, contact ou e-mail',
  'suppliers.filterLabel': 'Filtrer par état d’activation',
  'suppliers.allSuppliers': 'Tous les fournisseurs',
  'suppliers.active': 'Actif',
  'suppliers.inactive': 'Inactif',
  'suppliers.loadFailed': 'Le chargement des fournisseurs a échoué.',
  'suppliers.loading': 'Chargement des fournisseurs',
  'suppliers.emptyMatching': 'Aucun fournisseur correspondant',
  'suppliers.emptyNone': 'Aucun fournisseur pour le moment',
  'suppliers.emptyMatchingDescription':
    'Ajustez la recherche ou le filtre pour afficher plus de résultats.',
  'suppliers.emptyCreateDescription':
    'Ajoutez le premier fournisseur pour commencer à émettre des bons de commande.',
  'suppliers.emptyViewerDescription':
    'Un propriétaire, un administrateur ou un gestionnaire peut ajouter le premier fournisseur.',
  'suppliers.tableCaption': 'Répertoire des fournisseurs',
  'suppliers.contact': 'Contact',
  'suppliers.taxId': 'Matricule fiscal',
  'suppliers.deactivate': 'Désactiver',
  'suppliers.reactivate': 'Réactiver',
  'supplierDialog.editTitle': 'Modifier le fournisseur',
  'supplierDialog.newTitle': 'Nouveau fournisseur',
  'supplierDialog.description':
    'Les fournisseurs sont partagés par tous les bons de commande de cette organisation.',
  'supplierDialog.contactName': 'Nom du contact (facultatif)',
  'supplierDialog.email': 'E-mail (facultatif)',
  'supplierDialog.phone': 'Téléphone (facultatif)',
  'supplierDialog.address': 'Adresse (facultative)',
  'supplierDialog.city': 'Ville (facultative)',
  'supplierDialog.countryCode': 'Code pays (facultatif)',
  'supplierDialog.taxId': 'Matricule fiscal (facultatif)',
  'supplierDialog.notes': 'Notes (facultatives)',
  'supplierDialog.save': 'Enregistrer le fournisseur',
  'supplierDialog.create': 'Créer le fournisseur',
  'supplierDialog.saveFailed': 'Le fournisseur n’a pas pu être enregistré.',
  'supplierDialog.nameRequired': 'Saisissez le nom du fournisseur',
  'supplierDialog.invalidEmail': 'Saisissez une adresse e-mail valide',
  'supplierDialog.countryCodeInvalid': 'Utilisez un code pays à deux lettres',
};
