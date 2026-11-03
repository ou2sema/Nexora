import type { InvoiceMessages } from '../en/invoices';

export const invoices: InvoiceMessages = {
  'invoice.paymentStatus.unpaid': 'Impayée',
  'invoice.paymentStatus.partial': 'Partiellement payée',
  'invoice.paymentStatus.paid': 'Payée',

  'invoice.method.cash': 'Espèces',
  'invoice.method.bank_transfer': 'Virement bancaire',
  'invoice.method.card_manual': 'Carte (saisie à la main)',
  'invoice.method.credit': 'Crédit / sur compte',

  'invoice.detail.title': 'Facture',
  'invoice.detail.subtitle': 'Chargement de la facture…',
  'invoice.detail.loading': 'Chargement de la facture…',
  'invoice.detail.loadFailed': 'La facture n’a pas pu être chargée.',
  'invoice.detail.issuedOn': 'Émise le {when}',
  'invoice.detail.viewerReadOnly':
    'Votre rôle de lecteur est en lecture seule. Les paiements sont enregistrés par un propriétaire, administrateur ou gestionnaire.',

  'invoice.detail.customer': 'Client',
  'invoice.detail.depot': 'Dépôt',
  'invoice.detail.issued': 'Émise',
  'invoice.detail.volume': 'Volume',
  'invoice.detail.lineQuantity': '{lines} lignes / {quantity} unités',
  'invoice.detail.status': 'Paiement',
  'invoice.detail.net': 'Net (HT)',
  'invoice.detail.tax': 'Taxe',
  'invoice.detail.total': 'Brut (TTC)',
  'invoice.detail.paid': 'Encaissé',
  'invoice.detail.remaining': 'Reste dû',

  'invoice.detail.linesCaption': 'Lignes de la facture',
  'invoice.detail.columns.item': 'Article',
  'invoice.detail.columns.unitPrice': 'Prix unitaire',
  'invoice.detail.columns.taxRate': 'Taxe %',
  'invoice.detail.columns.total': 'Total',

  'invoice.detail.payments.title': 'Paiements enregistrés',
  'invoice.detail.payments.empty': 'Aucun paiement enregistré sur cette facture.',

  'invoice.detail.payment.heading': 'Enregistrer un paiement',
  'invoice.detail.payment.dueNow': 'Il reste {remaining} à payer sur cette facture.',
  'invoice.detail.payment.amount': 'Montant',
  'invoice.detail.payment.method': 'Moyen',
  'invoice.detail.payment.note': 'Note',
  'invoice.detail.payment.submit': 'Enregistrer le paiement',
  'invoice.detail.payment.invalid': 'Saisissez un montant en millimes.',
  'invoice.detail.payment.exceedsRemaining': 'Le paiement dépasse le montant restant dû.',
  'invoice.detail.payment.settlesInvoice': 'Ce montant solde exactement la facture.',
  'invoice.detail.payment.failed': 'Le paiement n’a pas pu être enregistré.',
  'invoice.detail.payment.recorded': 'Paiement enregistré sur {number} ; reste {remaining}.',
  'invoice.detail.payment.fullyPaid': '{number} est intégralement payée.',

  'invoice.detail.docs': 'Documents',
  'invoice.detail.docsHint':
    'Tous deux sont rendus depuis la facture enregistrée : la copie du client et celle du dépôt ne peuvent pas diverger.',
  'invoice.detail.downloadInvoice': 'Facture PDF',
  'invoice.detail.downloadIssueNote': 'Bon de sortie PDF',
  'invoice.detail.downloaded': '{filename} enregistré.',
  'invoice.detail.pdfFailed': 'Le document n’a pas pu être téléchargé.',
};
