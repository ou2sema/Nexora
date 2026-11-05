import type { GuideMessages } from '../en/guide';

export const guide: GuideMessages = {
  'guide.title': "Guide de l'utilisateur",
  'guide.description': "À quoi sert chaque écran, comment s'en servir et ce qu'il faut surveiller.",
  'guide.intro':
    "Nexora tient un seul registre par organisation. Chaque quantité affichée est le résultat de mouvements réellement enregistrés, et chaque document est imprimé à partir de ce même registre — aucun écran de l'application ne modifie le stock à la main.",
  'guide.toc': 'Dans ce guide',
  'guide.howTo': "Comment s'en servir",
  'guide.watchOut': 'Ce qu’il faut surveiller',
  'guide.openScreen': 'Ouvrir',

  'guide.signin.title': 'Connexion et choix de l’organisation',
  'guide.signin.purpose':
    "Se connecter ouvre l'espace de travail de votre organisation. Le sélecteur d'organisation dans la barre du haut est l'endroit où l'on change de dossier, et tout ce qui est à l'écran appartient à cette organisation et à personne d'autre.",
  'guide.signin.step1':
    'Saisissez l’adresse e-mail et le mot de passe que votre propriétaire vous a donnés, puis choisissez l’organisation dans la barre du haut.',
  'guide.signin.step2':
    'Choisissez votre langue dans cette même barre — français, anglais ou arabe. Le choix est mémorisé sur cet appareil et toute l’interface le suit, y compris les documents que vous imprimez.',
  'guide.signin.step3':
    'Si aucune organisation n’apparaît, vous n’avez pas encore été invité : demandez au propriétaire de cette organisation d’inviter votre adresse e-mail.',
  'guide.signin.watch':
    'Votre mot de passe n’est transmis qu’au formulaire de connexion. Aucun écran ne permet de lire ou de modifier les produits, le stock ou les documents d’une autre organisation.',

  'guide.dashboard.title': 'Lire le tableau de bord',
  'guide.dashboard.purpose':
    'Le tableau de bord est le point de contrôle quotidien : ce qui est en stock, ce qui a bougé récemment et ce qui demande une attention immédiate.',
  'guide.dashboard.step1':
    'Les compteurs proviennent du registre — unités reçues, unités sorties et quantité réellement disponible à cet instant.',
  'guide.dashboard.step2':
    'La cloche et la carte des stocks bas listent les produits au seuil de réapprovisionnement ou en dessous ; ce seuil se règle depuis cette même carte.',
  'guide.dashboard.step3':
    'Les mouvements récents sont la piste d’audit : chaque ligne indique pourquoi une quantité a changé et quel document ou commande l’a provoqué.',
  'guide.dashboard.step4':
    'La page se rafraîchit seule toutes les 30 secondes et se met à jour dès qu’un autre opérateur enregistre quelque chose.',
  'guide.dashboard.watch':
    'Une cloche indiquant « aucun » juste après un chargement raté signifie que le compte n’est pas arrivé. Rechargez la page au lieu de faire confiance au zéro.',

  'guide.sale.title': 'Vendre au comptoir',
  'guide.sale.purpose':
    "L'écran de vente transforme un panier en facture commerciale numérotée en une seule étape et sort le stock en même temps.",
  'guide.sale.step1':
    'Scannez ou recherchez chaque produit. Un lecteur physique se comporte comme un clavier : le code arrive sans clic, un bip court confirme la lecture, puis une fenêtre nomme le produit et demande la quantité à mettre au panier.',
  'guide.sale.step2':
    'Nommez l’acheteur — une vente au comptoir, ou un client que vous choisissez ou créez.',
  'guide.sale.step3':
    'Enregistrez le paiement. Vous pouvez encaisser une partie maintenant et laisser le reste sur le compte du client.',
  'guide.sale.step4':
    'Validez la vente. Le numéro de facture (FI-2026-0001) est donné par le système, compté par organisation et par année.',
  'guide.sale.step5':
    'Téléchargez la facture, ainsi que le bon de sortie si des appareils suivis par numéro de série ont quitté le dépôt.',
  'guide.sale.watch':
    'Une facture émise est définitive : pas de modification ni d’annulation, une erreur se corrige donc par un retour ou une nouvelle facture. Tous les montants sont calculés par la base de données, et une vente qui demande plus que le stock disponible est refusée au lieu de passer en négatif.',

  'guide.scan.title': 'Scanner : réceptionner et compter',
  'guide.scan.purpose':
    "La console de scan est l'endroit où le travail physique est enregistré : réception d'une commande d'achat, comptage d'une étagère et impression des étiquettes.",
  'guide.scan.step1':
    'Utilisez la caméra ou le champ de saisie. Nexora teste d’abord le code comme numéro de série ou IMEI d’un appareil, puis comme code-barres, comme SKU produit, puis comme code interne.',
  'guide.scan.step2':
    'Pour réceptionner, choisissez la ligne de la commande d’achat, confirmez la quantité et enregistrez — la réception devient un mouvement vers cet emplacement.',
  'guide.scan.step3':
    'Pour compter, démarrez un comptage sur un emplacement, saisissez ce que vous voyez réellement, puis validez. Seules les différences deviennent des mouvements.',
  'guide.scan.step4':
    'Les étiquettes s’impriment depuis le même écran : l’étiquette produit porte son code-barres, l’étiquette appareil porte son numéro de série.',
  'guide.scan.watch':
    'Un même code scanné deux fois en environ une seconde est ignoré volontairement : un lecteur qui envoie deux fois le code ne double pas le stock. Un comptage ne fixe jamais une quantité — il enregistre la différence qu’il a trouvée.',

  'guide.stock.title': 'Stock, mouvements et réservations',
  'guide.stock.purpose':
    'Ces quatre écrans montrent le même registre sous des angles différents ; aucun ne le modifie.',
  'guide.stock.step1':
    'Niveaux de stock : combien d’unités de chaque produit se trouvent dans chaque entrepôt et emplacement.',
  'guide.stock.step2':
    'Mouvements : tout l’historique, avec la raison de chaque changement — réception, sortie, vente, comptage — et le document correspondant.',
  'guide.stock.step3':
    'Réservations : les unités déjà mises de côté par une commande de sortie confirmée, pour qu’elles ne soient pas vendues deux fois.',
  'guide.stock.step4':
    'Réconciliation : ce que disent les soldes par rapport à ce que donnent les mouvements. Une organisation saine n’affiche aucune dérive.',
  'guide.stock.watch':
    'Il n’existe aucun écran où l’on tape une nouvelle quantité de stock. Si un nombre semble faux, l’explication est dans la liste des mouvements, et la réconciliation désigne la même ligne.',

  'guide.orders.title': 'Commandes de sortie et commandes d’achat',
  'guide.orders.purpose':
    'Les écrans de commande planifient le travail ; le comptoir et la console de scan sont les endroits où il se fait réellement.',
  'guide.orders.step1':
    'Les commandes de sortie passent de brouillon à confirmée puis servie. La confirmation réserve les unités, le service les sort.',
  'guide.orders.step2': 'Annuler une commande confirmée libère ce qu’elle avait réservé.',
  'guide.orders.step3':
    'Les commandes d’achat passent de brouillon à envoyée, puis sont réceptionnées ligne par ligne dans la console de scan ; une commande partiellement reçue reste ouverte jusqu’à la dernière ligne.',
  'guide.orders.step4':
    'Les retours ferment la boucle : un retour fournisseur renvoie des unités, un retour client les remet en stock.',
  'guide.orders.watch':
    'Un produit suivi par numéro de série ne se commande pas en quantité — chaque unité est scannée séparément. Enregistrer plus que ce qui a été reçu ou servi est refusé, et non réduit en douceur.',

  'guide.documents.title': 'Documents imprimés (français, arabe, anglais)',
  'guide.documents.purpose':
    'Chaque document est imprimé au moment du téléchargement, à partir du registre affiché à l’écran et dans la langue de votre interface.',
  'guide.documents.step1':
    'Factures, bons de sortie, commandes d’achat et notes de retour s’impriment au format A4 avec la marque de votre organisation.',
  'guide.documents.step2':
    'Changez la langue de l’interface et le téléchargement suivant change avec elle — la même facture existe en français et en arabe.',
  'guide.documents.step3':
    'La facture porte les totaux fiscaux : net, taxe, total, payé et restant. Le bon de sortie ne porte que les quantités et les numéros de série, et l’indique sur son intitulé : ce n’est pas un document fiscal.',
  'guide.documents.step4':
    'Les planches d’étiquettes produits et appareils s’impriment depuis la console de scan, dans les trois mêmes langues.',
  'guide.documents.watch':
    "L'adresse et le numéro fiscal du vendeur ne sont pas encore imprimés — c'est une décision à prendre, pas quelque chose qui se corrige depuis un écran. Un document correspond toujours au registre au moment où on le télécharge, donc imprimez-le au moment de la remise.",

  'guide.roles.title': 'Rôles, et ce que ce guide ne couvre pas',
  'guide.roles.purpose':
    "Ce que vous avez le droit de déclencher dépend de votre rôle, et la règle est appliquée par le serveur, pas seulement par l'interface.",
  'guide.roles.step1':
    'Propriétaire : tout, y compris l’équipe, les invitations et la marque de l’organisation.',
  'guide.roles.step2':
    'Administrateur et gestionnaire : enregistrent ventes, réceptions, comptages et commandes. Les gestionnaires peuvent inviter uniquement des lecteurs.',
  'guide.roles.step3':
    'Lecteur : consulte tous les écrans et télécharge tous les documents, sans rien modifier.',
  'guide.roles.step4':
    "L'administration est l'écran de celui qui pilote le déploiement lui-même, pas un écran de travail quotidien sur le stock.",
  'guide.roles.watch':
    'Un bouton visible mais inutilisable est le serveur qui refuse l’action, pas un écran cassé. Les changements d’équipe, les invitations et le logo de l’organisation appartiennent au propriétaire.',

  'guide.rules.title': 'Règles à retenir',
  'guide.rules.purpose':
    'Six réflexes de l’application qui expliquent la plupart de ce qu’elle fait — et la plupart de ce qu’elle refuse de faire.',
  'guide.rules.step1':
    'La monnaie est stockée en millimes et imprimée avec trois décimales : 1.000 TND, c’est un dinar.',
  'guide.rules.step2':
    'Les heures sont enregistrées en UTC et affichées dans votre propre format de date et d’heure.',
  'guide.rules.step3':
    'Appuyer deux fois sur un bouton est sans danger : la même action envoyée deux fois est reconnue et appliquée une seule fois.',
  'guide.rules.step4':
    'Le stock n’est jamais un nombre que l’on fixe. C’est la somme des mouvements enregistrés, et l’on peut toujours remonter de l’un aux autres.',
  'guide.rules.step5':
    'Les produits, quantités et documents d’une organisation sont invisibles pour toutes les autres.',
  'guide.rules.step6':
    'Les documents sont imprimés à la demande plutôt qu’archivés : ce que vous téléchargez correspond toujours au registre de cette seconde-là.',
};
