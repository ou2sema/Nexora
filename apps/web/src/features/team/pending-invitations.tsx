import { Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { useAcceptInvitation, usePendingInvitations } from './api';
import { roleKeys } from './labels';

/**
 * Rendered above the page content: an invitee can accept without first having
 * an organization, and the shell reruns /me after acceptance.
 */
export function PendingInvitations() {
  const { t, formatDate, errorMessage } = useI18n();
  const pending = usePendingInvitations();
  const accept = useAcceptInvitation();
  const items = pending.data?.items ?? [];

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-invitations-heading"
      className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4"
    >
      <div className="flex items-center gap-2">
        <Mail aria-hidden="true" className="size-4 text-indigo-700" />
        <h2 id="pending-invitations-heading" className="text-sm font-semibold text-indigo-900">
          {t('pendingInvitations.title')}
        </h2>
      </div>
      <p className="mt-1 text-sm text-indigo-800">{t('pendingInvitations.description')}</p>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-100"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{item.organizationName}</p>
              <p className="text-xs text-slate-500">
                {t('pendingInvitations.roleLine', {
                  role: t(roleKeys[item.role]),
                  date: formatDate(item.expiresAt),
                })}
              </p>
            </div>
            <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate(item.id)}>
              {t('pendingInvitations.accept')}
            </Button>
          </li>
        ))}
      </ul>

      {accept.error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage(accept.error, 'pendingInvitations.acceptFailed')}
        </p>
      )}
    </section>
  );
}
