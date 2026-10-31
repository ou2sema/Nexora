import type { ErrorsMessages } from '../en/errors';

export const errors: ErrorsMessages = {
  'errors.generic': 'Une erreur est survenue. Réessayez.',
  'errors.network': 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',

  'errors.code.http_error': 'La requête a échoué.',
  'errors.code.internal_error': 'Erreur interne du serveur',
  'errors.code.unauthenticated': 'Une authentification est requise.',
  'errors.code.unauthorized': 'Une authentification est requise.',
  'errors.code.invalid_token': 'Le jeton d’accès est invalide ou a expiré.',
  'errors.code.forbidden': 'Votre rôle ne permet pas cette action.',
  'errors.code.not_found': 'Enregistrement introuvable.',
  'errors.code.validation_error': 'Vérifiez les champs signalés.',
  'errors.code.conflict': 'Un enregistrement avec cette valeur existe déjà.',
  'errors.code.constraint_violation': 'Une contrainte de données a rejeté la requête.',
  'errors.code.invalid_reference':
    'Un enregistrement référencé n’existe pas dans cette organisation.',
  'errors.code.operation_unavailable': 'L’opération n’a pas pu aboutir. Réessayez.',
  'errors.code.rate_limited': 'Trop de requêtes. Réessayez dans un instant.',
  'errors.code.payload_too_large': 'La requête est trop volumineuse.',
  'errors.code.unsupported_media_type': 'Ce type de fichier n’est pas pris en charge.',
  'errors.code.unprocessable_entity': 'La requête n’a pas pu être traitée.',
  'errors.code.method_not_allowed': 'Cette action n’est pas disponible.',
  'errors.code.idempotency_conflict':
    'Cette clé d’idempotence a déjà été utilisée pour une autre requête.',
  'errors.code.idempotency_key_required':
    'Fournissez un en-tête Idempotency-Key de 8 à 120 caractères.',
  'errors.code.already_member': 'Cette personne est déjà membre de l’organisation.',
  'errors.code.invitation_already_pending': 'Une invitation est déjà en attente pour cet e-mail.',
  'errors.code.invitation_not_pending': 'Cette invitation n’est plus en attente.',
  'errors.code.invitation_expired':
    'Cette invitation a expiré. Demandez à un propriétaire ou administrateur d’en envoyer une nouvelle.',
  'errors.code.invitation_role_owner': 'La propriété ne peut pas être accordée par invitation.',
  'errors.code.invitation_email_mismatch':
    'Cette invitation a été envoyée à une autre adresse e-mail.',
  'errors.code.invitation_email_required':
    'Votre compte doit avoir une adresse e-mail pour accepter des invitations.',
  'errors.code.manager_invites_viewers_only':
    'Les gestionnaires ne peuvent inviter que des lecteurs. Demandez à un propriétaire ou administrateur d’ajouter un gestionnaire.',
  'errors.code.owner_required': 'Seul un propriétaire peut gérer les propriétaires.',
  'errors.code.platform_admin_required':
    'Seuls les administrateurs de la plateforme peuvent créer des organisations.',
  'errors.code.export_too_large': 'L’export dépasse {limit} lignes. Affinez les filtres.',
  'errors.code.organization_not_found': 'Organisation introuvable.',
  'errors.code.reservation_not_found': 'Réservation introuvable.',
  'errors.code.stock_count_not_found': 'Inventaire introuvable.',
  'errors.code.product_not_found': 'Produit introuvable.',
  'errors.code.device_not_found': 'Appareil introuvable.',
  'errors.code.warehouse_not_found': 'Entrepôt introuvable.',
  'errors.code.location_not_found': 'Emplacement introuvable.',
  'errors.code.supplier_not_found': 'Fournisseur introuvable.',
  'errors.code.purchase_order_not_found': 'Bon de commande introuvable.',
  'errors.code.purchase_order_line_not_found': 'Ligne de bon de commande introuvable.',
  'errors.code.sales_order_not_found': 'Bon de sortie introuvable.',
  'errors.code.sales_order_line_not_found': 'Ligne de bon de sortie introuvable.',
  'errors.code.purchase_return_not_found': 'Retour fournisseur introuvable.',
  'errors.code.sales_return_not_found': 'Retour client introuvable.',
  'errors.code.member_not_found': 'Membre de l’équipe introuvable.',
  'errors.code.invitation_not_found': 'Invitation introuvable.',
  'errors.code.scan_not_found': 'Aucun produit ni appareil ne correspond à ce code.',

  'errors.server.supplierNameConflict': 'Un fournisseur portant ce nom existe déjà.',
  'errors.server.deviceSerialConflict': 'Un appareil avec ce numéro de série est déjà enregistré.',
  'errors.server.deviceImeiConflict': 'Un appareil avec cet IMEI est déjà enregistré.',
  'errors.server.invitationRoleOwner':
    'La propriété se transfère en modifiant un membre existant, pas par invitation.',
  'errors.server.requiredMissing': 'Une valeur obligatoire est manquante.',
  'errors.server.invalidTypeOrRange': 'Une valeur a un type ou une plage invalide.',
  'errors.server.organizationCreateFailed': 'L’organisation n’a pas pu être créée.',
  'errors.server.organizationReadFailed': 'L’organisation n’a pas pu être relue après sa création.',
  'errors.server.explicitSlugRequired':
    'Fournissez un identifiant explicite : le nom ne contient ni lettre ni chiffre.',
  'errors.server.platformAdminAccessRequired':
    'L’accès administrateur de la plateforme est requis.',
  'errors.server.productCreateFailed': 'Le produit n’a pas pu être créé.',
  'errors.server.productReadFailed': 'Le produit n’a pas pu être lu.',
  'errors.server.categoryCreateFailed': 'La catégorie n’a pas pu être créée.',
  'errors.server.brandCreateFailed': 'La marque n’a pas pu être créée.',
  'errors.server.warehouseCreateFailed': 'L’entrepôt n’a pas pu être créé.',
  'errors.server.locationCreateFailed': 'L’emplacement n’a pas pu être créé.',
  'errors.server.invitationUnexpected': 'Réponse inattendue du service d’invitation.',
  'errors.server.membershipNotCreated': 'L’adhésion n’a pas pu être créée.',
  'errors.server.requestValidationFailed': 'La validation de la requête a échoué.',
  'errors.server.bearerTokenRequired': 'Un jeton d’accès Bearer est requis.',
  'errors.server.barcodeNotAssigned': 'Le code-barres n’a pas été attribué.',
  'errors.server.unexpectedDeviceOperation': 'Réponse inattendue de l’opération sur l’appareil.',
  'errors.server.unexpectedOperation': 'Réponse inattendue de l’opération.',
  'errors.server.unexpectedSupplierResponse': 'Réponse inattendue du fournisseur.',
  'errors.server.unexpectedStockOperation': 'Réponse inattendue de l’opération de stock.',
  'errors.server.unexpectedStockCount': 'Réponse inattendue de l’inventaire.',

  'errors.server.categoryCycle': 'Une catégorie ne peut pas être son propre ancêtre.',
  'errors.server.organizationRequiresOwner':
    'Une organisation doit conserver au moins un propriétaire.',
  'errors.server.insufficientStock': 'Stock insuffisant pour ce mouvement.',
  'errors.server.stockReserved': 'La quantité demandée est réservée pour un bon de sortie.',
  'errors.server.reservationNotActive': 'La réservation n’est plus active.',
  'errors.server.reservationMismatch': 'La réservation ne correspond pas à cette sortie.',
  'errors.server.reservationAlreadyFulfilled': 'La réservation a déjà été honorée.',
  'errors.server.stockCountAlreadyOpen': 'Un inventaire est déjà ouvert pour cet emplacement.',
  'errors.server.stockCountNotOpen': 'Cet inventaire n’est plus ouvert.',
  'errors.server.stockCountEmpty': 'Enregistrez au moins une ligne avant de valider l’inventaire.',
  'errors.server.stockCountBelowReserved':
    'La quantité comptée est inférieure à la quantité réservée.',
  'errors.server.productNotCountable':
    'Les produits sérialisés sont suivis par appareil, pas par quantité.',
  'errors.server.supplierInactive': 'Ce fournisseur est inactif.',
  'errors.server.productSerializedOrderUnsupported':
    'Les produits sérialisés sont émis par appareil, pas via une ligne de commande.',
  'errors.server.purchaseOrderOverReceipt': 'La quantité reçue dépasse la quantité commandée.',
  'errors.server.purchaseOrderNotReceivable':
    'Seuls les bons de commande commandés peuvent recevoir du stock.',
  'errors.server.purchaseOrderNotCancellable':
    'Un bon de commande ayant reçu du stock ne peut pas être annulé.',
  'errors.server.purchaseOrderNotDraft':
    'Seuls les bons de commande en brouillon peuvent être commandés.',
  'errors.server.salesOrderNotDraft':
    'Seuls les bons de sortie en brouillon peuvent être confirmés.',
  'errors.server.salesOrderNotFulfillable':
    'Seuls les bons de sortie confirmés peuvent être honorés.',
  'errors.server.salesOrderNotCancellable':
    'Seuls les bons de sortie en brouillon ou confirmés peuvent être annulés.',
  'errors.server.salesOrderReservationMissing': 'Ce bon de sortie n’a pas sa réservation de stock.',
  'errors.server.serialCountMismatch': 'Fournissez un numéro de série par unité reçue.',
  'errors.server.serialNumbersNotSupported':
    'Ce produit n’est pas sérialisé ; retirez les numéros de série.',
  'errors.server.purchaseOrderNotReturnable':
    'Seuls les bons de commande reçus peuvent être retournés.',
  'errors.server.purchaseReturnExceedsReceived':
    'Le retour dépasse la quantité reçue et non encore retournée.',
  'errors.server.purchaseReturnNotPostable':
    'Seuls les retours fournisseur en brouillon peuvent être validés.',
  'errors.server.purchaseReturnNotCancellable':
    'Seuls les retours fournisseur en brouillon peuvent être annulés.',
  'errors.server.salesOrderNotReturnable':
    'Seuls les bons de sortie honorés peuvent être retournés.',
  'errors.server.salesReturnExceedsFulfilled':
    'Le retour dépasse la quantité honorée et non encore retournée.',
  'errors.server.salesReturnNotPostable':
    'Seuls les retours client en brouillon peuvent être validés.',
  'errors.server.salesReturnNotCancellable':
    'Seuls les retours client en brouillon peuvent être annulés.',
  'errors.server.deviceNotInStock': 'Cet appareil n’est pas en stock.',
  'errors.server.deviceProductMismatch': 'Cet appareil n’appartient pas au produit de la ligne.',

  'errors.server.orderRequiresLines': 'Ajoutez au moins une ligne.',
  'errors.server.orderTooManyLines': 'Une commande peut contenir au maximum 100 lignes.',
  'errors.server.orderLineInvalid': 'Chaque ligne nécessite un produit et une quantité positive.',
  'errors.server.duplicateOrderLine': 'Chaque produit ne peut apparaître qu’une seule fois.',
  'errors.server.customerNameRequired': 'Saisissez le nom du client.',
  'errors.server.invalidSupplierName': 'Saisissez le nom d’un fournisseur.',
  'errors.server.invalidCountryCode': 'Utilisez un code pays à deux lettres.',
  'errors.server.invalidQuantity': 'La quantité doit être supérieure à zéro.',
  'errors.server.returnReasonRequired': 'Expliquez le motif du retour (au moins 3 caractères).',
  'errors.server.returnLineInvalid':
    'Chaque ligne de retour nécessite une ligne de commande et une quantité positive.',
  'errors.server.duplicateDevice': 'Chaque appareil ne peut apparaître qu’une seule fois.',
  'errors.server.invalidInvitationEmail': 'Saisissez une adresse e-mail valide pour l’invitation.',

  'errors.auth.invalidCredentials': 'Identifiants de connexion invalides',
  'errors.auth.emailNotConfirmed': 'E-mail non confirmé',
  'errors.auth.userExists': 'Cet utilisateur est déjà enregistré',
  'errors.auth.passwordTooShort': 'Le mot de passe doit contenir au moins 6 caractères',
  'errors.auth.signupsDisabled': 'Les inscriptions ne sont pas autorisées pour cette instance',
  'errors.auth.rateLimited': 'Limite d’envoi d’e-mails atteinte',
  'errors.auth.emailRequired': 'Une adresse e-mail est requise',
  'errors.auth.sessionExpired': 'Votre session a expiré. Reconnectez-vous.',
};
