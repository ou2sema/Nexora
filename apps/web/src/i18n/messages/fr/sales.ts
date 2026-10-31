import type { SalesMessages } from '../en/sales';

export const sales: SalesMessages = {
  'sales.title': 'Commandes sortantes',
  'sales.description':
    'Les commandes clients réservent le stock à la confirmation et le sortent à l’exécution.',
  'sales.newOrder': 'Nouvelle commande sortante',
  'sales.viewerReadOnly':
    'Votre rôle de lecteur est en lecture seule. Les propriétaires, administrateurs et gestionnaires gèrent les commandes sortantes.',
  'sales.searchLabel': 'Rechercher des commandes sortantes',
  'sales.searchPlaceholder': 'Rechercher par numéro ou client',
  'sales.filterStatus': 'Filtrer par statut',
  'sales.allStatuses': 'Tous les statuts',
  'sales.loadFailed': 'Les commandes sortantes n’ont pas pu être chargées.',
  'sales.loading': 'Chargement des commandes sortantes',
  'sales.emptyFilteredTitle': 'Aucune commande sortante correspondante',
  'sales.emptyTitle': 'Aucune commande sortante pour le moment',
  'sales.emptyFilteredBody':
    'Ajustez la recherche ou le filtre de statut pour afficher plus de résultats.',
  'sales.emptyBody':
    'Créez la première commande sortante pour réserver et sortir du stock destiné à un client.',
  'sales.emptyBodyReadOnly':
    'Un propriétaire, un administrateur ou un gestionnaire peut créer la première commande sortante.',
  'sales.columns.number': 'Numéro',
  'sales.columns.customer': 'Client',
  'sales.columns.linesQty': 'Lignes / qté',
  'sales.columns.created': 'Créée le',
  'sales.columns.open': 'Ouverte',
  'sales.openAction': 'Ouvrir',

  'sales.status.draft': 'Brouillon',
  'sales.status.confirmed': 'Confirmée',
  'sales.status.fulfilled': 'Exécutée',
  'sales.status.cancelled': 'Annulée',

  'sales.create.description':
    'La confirmation réserve le stock ; l’exécution le sort. Les produits sérialisés se vendent à l’appareil.',
  'sales.create.creating': 'Création…',
  'sales.create.submit': 'Créer la commande sortante',
  'sales.create.failed': 'La commande sortante n’a pas pu être créée.',

  'sales.form.customerName': 'Nom du client',
  'sales.form.referenceOptional': 'Référence (facultatif)',
  'sales.form.emailOptional': 'E-mail (facultatif)',
  'sales.form.phoneOptional': 'Téléphone (facultatif)',
  'sales.form.lines': 'Lignes',
  'sales.form.addLine': 'Ajouter une ligne',
  'sales.form.linesHint':
    'Seuls les produits actifs et non sérialisés peuvent être vendus via une ligne de commande.',
  'sales.form.selectProduct': 'Sélectionnez un produit',
  'sales.form.unitPrice': 'Prix unitaire (TND)',
  'sales.form.notesOptional': 'Notes (facultatif)',
  'sales.form.removeLine': 'Supprimer la ligne {index}',
  'sales.form.customerNameRequired': 'Saisissez le nom du client',
  'sales.form.invalidEmail': 'Saisissez une adresse e-mail valide',
  'sales.form.invalidPrice': 'Utilisez un montant positif avec 3 décimales au maximum',
  'sales.form.invalidQuantity': 'Saisissez une quantité supérieure à zéro',
  'sales.form.addLineRequired': 'Ajoutez au moins une ligne',
  'sales.form.duplicateProduct': 'Chaque produit ne peut apparaître qu’une seule fois',

  'sales.detail.title': 'Commande sortante',
  'sales.detail.subtitle': '{status} · {warehouse} / {location}',
  'sales.detail.loading': 'Chargement de la commande sortante…',
  'sales.detail.loadingOrder': 'Chargement de la commande…',
  'sales.detail.loadFailed': 'La commande n’a pas pu être chargée.',
  'sales.detail.contact': 'Contact',
  'sales.detail.returned': 'Retournée',
  'sales.detail.unitPrice': 'Prix unitaire',
  'sales.detail.reservation': 'Réservation',
  'sales.detail.confirm': 'Confirmer et réserver le stock',
  'sales.detail.confirming': 'Confirmation…',
  'sales.detail.fulfil': 'Exécuter et sortir le stock',
  'sales.detail.fulfilling': 'Exécution…',
  'sales.detail.confirmFailed': 'La commande n’a pas pu être confirmée.',
  'sales.detail.fulfilFailed': 'La commande n’a pas pu être exécutée.',
  'sales.detail.cancelFailed': 'La commande n’a pas pu être annulée.',
  'sales.detail.reserved.zero': 'Réservé {count} unité pour {order}.',
  'sales.detail.reserved.one': 'Réservé {count} unité pour {order}.',
  'sales.detail.reserved.two': 'Réservé {count} unités pour {order}.',
  'sales.detail.reserved.few': 'Réservé {count} unités pour {order}.',
  'sales.detail.reserved.many': 'Réservé {count} unités pour {order}.',
  'sales.detail.reserved.other': 'Réservé {count} unités pour {order}.',
  'sales.detail.issued.zero': 'Sorti {count} unité pour {order}.',
  'sales.detail.issued.one': 'Sorti {count} unité pour {order}.',
  'sales.detail.issued.two': 'Sorti {count} unités pour {order}.',
  'sales.detail.issued.few': 'Sorti {count} unités pour {order}.',
  'sales.detail.issued.many': 'Sorti {count} unités pour {order}.',
  'sales.detail.issued.other': 'Sorti {count} unités pour {order}.',
  'sales.detail.cancelledWithReservations.zero':
    'La commande {order} a été annulée et {count} réservation libérée.',
  'sales.detail.cancelledWithReservations.one':
    'La commande {order} a été annulée et {count} réservation libérée.',
  'sales.detail.cancelledWithReservations.two':
    'La commande {order} a été annulée et {count} réservations libérées.',
  'sales.detail.cancelledWithReservations.few':
    'La commande {order} a été annulée et {count} réservations libérées.',
  'sales.detail.cancelledWithReservations.many':
    'La commande {order} a été annulée et {count} réservations libérées.',
  'sales.detail.cancelledWithReservations.other':
    'La commande {order} a été annulée et {count} réservations libérées.',

  'sales.cancel.heading': 'Annuler la commande',
  'sales.cancel.help': 'L’annulation libère toute réservation associée à cette commande.',
  'sales.cancel.reasonLabel': 'Motif d’annulation',
  'sales.cancel.reasonPlaceholder': 'Motif (facultatif)',
  'sales.cancel.cancelling': 'Annulation…',
  'sales.cancel.submit': 'Annuler la commande',
};
