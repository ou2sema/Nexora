import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { MAX_LOGO_BYTES, type LogoSummary, type MemberRole } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useLogoImage, useRemoveLogo, useUploadLogo } from '@/features/branding/api';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';

const LOGO_KILOBYTES = MAX_LOGO_BYTES / 1024;

interface BrandingCardProps {
  logo: LogoSummary | null;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
}

export function BrandingCard({ logo, organizationId, organizationName, role }: BrandingCardProps) {
  const { t, formatNumber, errorMessage } = useI18n();
  const canEdit = role !== 'viewer';

  const inputRef = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<MessageKey | null>(null);

  const logoUrl = useLogoImage(logo);
  const upload = useUploadLogo(organizationId);
  const remove = useRemoveLogo(organizationId);

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setRejection('team.branding.choosePngOrJpeg');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setRejection('team.branding.tooLarge');
      return;
    }
    setRejection(null);
    upload.mutate(file);
  };

  const failure = rejection
    ? t(rejection, { limit: formatNumber(LOGO_KILOBYTES) })
    : upload.error
      ? errorMessage(upload.error, 'team.branding.uploadFailed')
      : remove.error
        ? errorMessage(remove.error, 'team.branding.removeFailed')
        : null;

  return (
    <section
      aria-labelledby="team-branding-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <ImagePlus aria-hidden="true" className="size-4 text-slate-500" />
        <h2 id="team-branding-heading" className="text-sm font-semibold text-slate-900">
          {t('team.branding.heading')}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-5 px-4 py-4">
        <div className="flex size-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={t('team.branding.previewAlt', { organizationName })}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-1 text-center text-xs text-slate-500">
              {t('team.branding.empty')}
            </span>
          )}
        </div>

        <div className="min-w-60 flex-1 space-y-3">
          <p className="text-sm text-slate-600">{t('team.branding.description')}</p>
          <p className="text-xs text-slate-500">
            {t('team.branding.formats', { limit: formatNumber(LOGO_KILOBYTES) })}
          </p>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                aria-label={t('team.branding.fileLabel')}
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant={logoUrl ? 'secondary' : 'primary'}
                disabled={upload.isPending}
                onClick={() => inputRef.current?.click()}
              >
                {upload.isPending
                  ? t('team.branding.uploading')
                  : logoUrl
                    ? t('team.branding.replace')
                    : t('team.branding.upload')}
              </Button>
              {logoUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => {
                    setRejection(null);
                    remove.mutate();
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {remove.isPending ? t('team.branding.removing') : t('team.branding.remove')}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t('team.branding.readOnly')}</p>
          )}
        </div>
      </div>

      {failure && (
        <p
          role="alert"
          className="border-t border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {failure}
        </p>
      )}
    </section>
  );
}
