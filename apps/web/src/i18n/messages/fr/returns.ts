import type { ReturnsMessages } from '../en/returns';

export const returns: ReturnsMessages = {
  'returns.status.draft': 'Brouillon',
  'returns.status.posted': 'Validé',
  'returns.status.cancelled': 'Annulé',
  'returns.loadFailed': 'Les retours n’ont pas pu être chargés.',
  'returns.empty': 'Aucun retour enregistré pour cette commande.',
  'returns.columns.number': 'Numéro',
  'returns.postAction': 'Valider le retour',
  'returns.cancelAction': 'Annuler le retour',
  'returns.preparing': 'Préparation…',
  'returns.downloadPdf': 'Télécharger le PDF',
  'returns.downloaded': '{filename} téléchargé',
  'returns.downloadFailed': 'Le bon de retour n’a pas pu être généré.',
  'returns.postFailed': 'Le retour n’a pas pu être validé.',
  'returns.cancelFailed': 'Le retour n’a pas pu être annulé.',
  'returns.cancelled': 'Le retour {number} a été annulé.',
  'returns.createFailed': 'Le retour n’a pas pu être créé.',

  'returns.form.referenceOptional': 'Référence (facultatif)',
  'returns.form.quantityLabel': 'Quantité à retourner pour {sku}',
  'returns.form.creating': 'Création…',
  'returns.form.submit': 'Créer le retour',

  'returns.devicePicker.summary': 'Unités en stock de {product} ({selected} sélectionné(s))',
  'returns.devicePicker.loading': 'Chargement des appareils…',
  'returns.devicePicker.empty': 'Aucun appareil en stock ne peut être retourné.',
  'returns.devicePicker.deviceLabel': 'Retourner l’appareil {serial}',

  'returns.purchase.heading': 'Retours au fournisseur',
  'returns.purchase.help':
    'Les retours sont comptabilisés comme des sorties de stock ; les unités sérialisées sont mises au rebut avec l’historique complet de l’appareil.',
  'returns.purchase.new': 'Nouveau retour fournisseur',
  'returns.purchase.dialogTitle': 'Retourner les marchandises au fournisseur',
  'returns.purchase.dialogDescription':
    'Un brouillon de retour ne déplace pas le stock. Sa validation sort la quantité ou met au rebut les appareils choisis.',
  'returns.purchase.returnable': 'Retournable : {returnable} sur {received} reçus',
  'returns.purchase.reasonTooShort':
    'Expliquez pourquoi les marchandises sont retournées (3 caractères minimum).',
  'returns.purchase.emptySelection':
    'Saisissez une quantité ou sélectionnez au moins un appareil à retourner.',
  'returns.purchase.created': 'Retour fournisseur {number} créé en brouillon.',
  'returns.purchase.allReturned': 'Toutes les lignes reçues ont été retournées.',
  'returns.purchase.posted': 'Retour {number} validé. Le stock et les appareils sont mis à jour.',

  'returns.sales.heading': 'Retours clients',
  'returns.sales.help':
    'La validation d’un retour client réintègre la quantité dans l’emplacement de la commande.',
  'returns.sales.new': 'Nouveau retour client',
  'returns.sales.dialogTitle': 'Réapprovisionner un retour client',
  'returns.sales.dialogDescription':
    'La validation du brouillon réintègre la quantité dans l’emplacement de stock de la commande.',
  'returns.sales.returnable': 'Retournable : {returnable} sur {fulfilled} exécutés',
  'returns.sales.reasonTooShort':
    'Expliquez pourquoi les marchandises reviennent (3 caractères minimum).',
  'returns.sales.emptySelection': 'Saisissez une quantité à réintégrer.',
  'returns.sales.created': 'Retour client {number} créé en brouillon.',
  'returns.sales.allReturned': 'Toutes les lignes exécutées ont été retournées.',
  'returns.sales.posted': 'Retour {number} validé. Le stock est réintégré.',
};
