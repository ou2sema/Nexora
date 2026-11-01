import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/i18n/provider';

type Values = { email: string; password: string };
type Mode = 'sign-in' | 'sign-up';

export function SignInPage() {
  const { status, signIn, signUp } = useAuth();
  const { t, errorMessage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t('auth.invalidEmail')),
        password: z.string().min(8, t('auth.passwordTooShort')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const returnTo =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? (location.state as { from: string }).from
      : '/';

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      if (mode === 'sign-in') {
        await signIn(values.email, values.password);
        navigate(returnTo, { replace: true });
      } else {
        const result = await signUp(values.email, values.password);
        if (result.needsConfirmation) {
          setConfirmationSentTo(values.email);
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (error) {
      setSubmitError(errorMessage(error, 'auth.failed'));
    }
  });

  return (
    <div className="grid min-h-dvh bg-slate-50 lg:grid-cols-2">
      <a href="#sign-in-form" className="skip-link">
        {t('auth.skipToForm')}
      </a>

      <aside className="hidden flex-col justify-between bg-ink-950 p-10 lg:flex">
        <BrandMark logoClassName="h-10" textClassName="text-xl font-bold text-white" />

        <div className="text-center">
          <h1 className="text-5xl font-bold uppercase tracking-tight text-white">Nexora</h1>
          <p className="mt-6 text-3xl font-semibold uppercase tracking-tight text-white">
            {t('auth.tagline')}
          </p>
        </div>

        <div />
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="lg:hidden">
              <BrandMark logoClassName="h-10" textClassName="text-xl text-slate-900" />
            </div>
            <div className="ms-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
              {mode === 'sign-in' ? t('auth.signInTitle') : t('auth.signUpTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {mode === 'sign-in' ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
            </p>

            {confirmationSentTo ? (
              <div
                id="sign-in-form"
                role="status"
                className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
              >
                <p className="font-semibold">{t('auth.checkInbox')}</p>
                <p className="mt-1">{t('auth.confirmationSent', { email: confirmationSentTo })}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => {
                    setConfirmationSentTo(null);
                    setMode('sign-in');
                  }}
                >
                  {t('auth.backToSignIn')}
                </Button>
              </div>
            ) : (
              <form id="sign-in-form" noValidate className="mt-8 space-y-4" onSubmit={submit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    {t('auth.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder={t('auth.emailPlaceholder')}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p id="email-error" role="alert" className="mt-1 text-xs text-rose-700">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    {t('auth.password')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    dir="ltr"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p id="password-error" role="alert" className="mt-1 text-xs text-rose-700">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {submitError && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {submitError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {mode === 'sign-in' ? t('auth.signIn') : t('auth.signUp')}
                </Button>

                {mode === 'sign-in' ? (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        setMode('sign-up');
                        setSubmitError(null);
                      }}
                    >
                      {t('auth.createOne')}
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-600">
                    {t('auth.haveAccount')}{' '}
                    <button
                      type="button"
                      className="font-semibold text-blue-700 hover:text-blue-800"
                      onClick={() => {
                        setMode('sign-in');
                        setSubmitError(null);
                      }}
                    >
                      {t('auth.signIn')}
                    </button>
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
