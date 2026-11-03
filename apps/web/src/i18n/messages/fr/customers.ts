import type { CustomerMessages } from '../en/customers';

export const customers: CustomerMessages = {
  'customer.newTitle': 'Nouveau client',
  'customer.editTitle': 'Modifier le client',
  'customer.save.failed': "Le client n'a pas pu être enregistré.",

  'customer.form.description':
    "L'identification imprimée sur la facture. L'historique d'achats, les plafonds de crédit et les soldes ne sont pas conservés ici.",
  'customer.form.name': 'Nom',
  'customer.form.nameRequired': 'Indiquez le nom que la facture doit porter.',
  'customer.form.email': 'E-mail',
  'customer.form.invalidEmail': 'Saisissez une adresse e-mail valide, ou laissez le champ vide.',
  'customer.form.phone': 'Téléphone',
  'customer.form.address': 'Adresse',
  'customer.form.city': 'Ville',
  'customer.form.country': 'Pays',
  'customer.form.invalidCountry': 'Utilisez un code pays sur deux lettres.',
  'customer.form.taxId': 'Matricule fiscal',
  'customer.form.fiscalNote':
    'Le nom, le matricule et l’adresse sont recopiés sur chaque facture au moment de la vente : une modification ultérieure ne réécrit jamais un document déjà émis.',
  'customer.form.save': 'Enregistrer le client',
  'customer.form.create': 'Créer le client',

  'customers.title': 'Clients',
  'customers.description':
    'Le répertoire sur lequel le comptoir facture. Un acheteur de passage peut tout de même être nommé sur la vente sans être enregistré.',
  'customers.newCustomer': 'Nouveau client',
  'customers.viewerReadOnly':
    'Votre rôle observateur est en lecture seule. Les propriétaires, administrateurs et gérants tiennent à jour le répertoire clients.',
  'customers.searchLabel': 'Rechercher un client',
  'customers.searchPlaceholder': 'Nom, e-mail, téléphone ou matricule',
  'customers.filterLabel': 'Filtrer par statut',
  'customers.allCustomers': 'Tous les clients',
  'customers.active': 'Actif',
  'customers.inactive': 'Inactif',
  'customers.loading': 'Chargement des clients',
  'customers.loadFailed': "Les clients n'ont pas pu être chargés.",
  'customers.activationFailed': 'Le statut du client n’a pas pu être modifié.',
  'customers.emptyNone': 'Aucun client pour le moment',
  'customers.emptyMatching': 'Aucun client correspondant',
  'customers.emptyMatchingDescription':
    'Modifiez la recherche ou le filtre de statut pour voir plus de résultats.',
  'customers.emptyCreateDescription':
    'Ajoutez les acheteurs que vous facturez régulièrement ; un nom ponctuel peut être saisi directement sur la vente.',
  'customers.emptyViewerDescription':
    'Un propriétaire, administrateur ou gérant peut ajouter le premier client.',
  'customers.tableCaption': 'Répertoire clients',
  'customers.columns.customer': 'Client',
  'customers.columns.contact': 'Contact',
  'customers.columns.since': 'Connu depuis',
  'customers.taxId': 'Matricule',
  'customers.deactivate': 'Désactiver',
  'customers.reactivate': 'Réactiver',
};
