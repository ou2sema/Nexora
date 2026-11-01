import type { AdminMessages } from '../en/admin';

export const admin: AdminMessages = {
  'admin.title': 'Administration',
  'admin.description':
    'Créez des organisations et gérez les adhésions sur toute la plateforme. Les données métier restent limitées aux membres de chaque organisation.',
  'admin.inviteMember': 'Inviter un membre',
  'admin.newOrganization': 'Nouvelle organisation',
  'admin.organizationsHeading': 'Organisations',
  'admin.total': '{count} au total',
  'admin.organizationsLoadFailed': 'Le chargement des organisations a échoué.',
  'admin.loadingOrganizations': 'Chargement des organisations',
  'admin.emptyTitle': 'Aucune organisation pour le moment',
  'admin.emptyBody':
    'Créez la première organisation et invitez éventuellement son premier gestionnaire ou lecteur.',
  'admin.organizationsCaption': 'Organisations de cette plateforme',
  'admin.membersColumn': 'Membres',
  'admin.pendingInvitationsColumn': 'Invitations en attente',
  'admin.createdColumn': 'Créée le',
  'admin.invite': 'Inviter',
  'admin.manageTeam': 'Gérer l’équipe',
  'admin.auditHeading': 'Activité des opérateurs',
  'admin.auditLoadFailed': 'Le chargement de l’activité a échoué.',
  'admin.auditLoading': 'Chargement de l’activité…',
  'admin.auditEmpty':
    'Aucune activité d’opérateur pour le moment. Les modifications d’organisation, d’invitation et de rôle effectuées depuis l’administration sont enregistrées ici.',
  'admin.auditCaption': 'Activité récente d’administration de la plateforme',
  'admin.whenColumn': 'Quand',
  'admin.actionColumn': 'Action',
  'admin.targetColumn': 'Cible',
  'admin.actorColumn': 'Auteur',
  'admin.audit.action.organizationCreated': 'Organisation créée',
  'admin.audit.action.invitationCreated': 'Membre invité',
  'admin.audit.action.invitationRevoked': 'Invitation révoquée',
  'admin.audit.action.memberRoleChanged': 'Rôle modifié',
  'admin.audit.action.memberRemoved': 'Membre retiré',
  'admin.audit.invitationDetail': 'Invitation {role}',
  'admin.audit.memberRemovedDetail': 'était {role}',
  'admin.createOrganizationDescription':
    'Vous en devenez le propriétaire. Invitez éventuellement le premier gestionnaire ou lecteur en choisissant son rôle ci-dessous.',
  'admin.footer':
    'L’administration de la plateforme couvre les organisations, les adhésions et les invitations. Le stock, le catalogue, les appareils et les commandes nécessitent une adhésion à l’organisation concernée.',
  'adminTeam.organizationFallback': 'cette organisation',
  'adminInvite.title': 'Inviter un membre',
  'adminInvite.description':
    'Choisissez l’organisation et le rôle. Nexora n’envoie pas d’e-mail ; partagez l’invitation en attente avec la personne ; elle apparaîtra après sa connexion avec cette adresse.',
  'adminInvite.organizationRequired': 'Choisissez une organisation',
  'adminInvite.emailRequired': 'Saisissez une adresse e-mail',
  'adminInvite.emailInvalid': 'Saisissez une adresse e-mail valide',
  'adminInvite.roleLabel': 'Rôle',
  'adminInvite.ownershipNote':
    'La propriété est transférée en modifiant un membre existant, et non par invitation.',
  'adminInvite.createFailed': 'L’invitation n’a pas pu être créée.',
  'adminInvite.sending': 'Envoi…',
  'adminInvite.send': 'Envoyer l’invitation',
};
