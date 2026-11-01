import type { OrganizationsMessages } from '../en/organizations';

export const organizations: OrganizationsMessages = {
  'organizations.label': 'Organisation',
  'organizations.none': 'Aucune organisation',
  'organizations.createAction': 'Créer une organisation',
  'organizations.newShort': 'Nouvelle org.',
  'organizations.createTitle': 'Créer une organisation',
  'organizations.createDescription':
    'Vous en devenez le propriétaire. L’identifiant est dérivé du nom et doit être unique.',
  'organizations.onboarding.title': 'Votre compte n’appartient encore à aucune organisation',
  'organizations.onboarding.body':
    'Un administrateur de la plateforme crée les organisations et désigne le premier gestionnaire. Si vous avez été invité, demandez-lui d’envoyer l’invitation à cette adresse e-mail ; elle apparaît dans la bannière des invitations en attente après votre connexion.',
  'organizations.onboarding.note':
    'Nexora n’envoie pas d’e-mail d’invitation. La personne qui vous a invité vous la transmettra directement.',
  'organizations.form.name': 'Nom de l’organisation',
  'organizations.form.nameRequired': 'Saisissez le nom d’une organisation',
  'organizations.form.slugHint': 'Un identifiant compatible avec les URL est dérivé du nom.',
  'organizations.form.firstMember': 'Premier membre',
  'organizations.form.firstMemberHint':
    'Facultatif. Vous devenez propriétaire ; cette personne reçoit une invitation pour le rôle sélectionné.',
  'organizations.form.email': 'E-mail',
  'organizations.form.invalidEmail': 'Saisissez une adresse e-mail valide',
  'organizations.form.role': 'Rôle',
  'organizations.form.create': 'Créer l’organisation',
  'organizations.form.creating': 'Création…',
  'organizations.form.failed': 'L’organisation n’a pas pu être créée.',
};
