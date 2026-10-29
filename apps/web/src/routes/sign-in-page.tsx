import { zodResolver } from '@hookform/resolvers/zod';
import { Boxes, Loader2, LockKeyhole, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type Values = z.infer<typeof schema>;
type Mode = 'sign-in' | 'sign-up';

export function SignInPage() {
  const { status, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

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
      setSubmitError(error instanceof Error ? error.message : 'Authentication failed.');
    }
  });

  return (
    <div className="grid min-h-dvh bg-slate-50 lg:grid-cols-2">
      <a href="#sign-in-form" className="skip-link">
        Skip to sign-in form
      </a>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 text-slate-300 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 text-white">
            <Boxes aria-hidden="true" className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Mystock</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Electronics inventory you can audit.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Multi-warehouse stock, serialized devices and TND valuation — all derived from an
            append-only ledger.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 text-indigo-400" />
              Organization-isolated data enforced in the database, not just the UI.
            </li>
            <li className="flex items-start gap-3">
              <ScrollText aria-hidden="true" className="mt-0.5 size-4 text-indigo-400" />
              Every stock change traceable to an actor, reason and document.
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">Tunisian dinar · English interface · Phase 2</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">
              <Boxes aria-hidden="true" className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">Mystock</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'sign-in'
              ? 'Use the email and password associated with your invitation.'
              : 'The first account can then create an organization.'}
          </p>

          {confirmationSentTo ? (
            <div
              id="sign-in-form"
              role="status"
              className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              <p className="font-semibold">Check your inbox</p>
              <p className="mt-1">
                We sent a confirmation link to {confirmationSentTo}. Confirm it, then sign in.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setConfirmationSentTo(null);
                  setMode('sign-in');
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form id="sign-in-form" noValidate className="mt-8 space-y-4" onSubmit={submit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
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
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
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

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </Button>

              <p className="text-center text-sm text-slate-600">
                {mode === 'sign-in' ? 'No account yet?' : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="font-semibold text-indigo-700 hover:text-indigo-800"
                  onClick={() => {
                    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                    setSubmitError(null);
                  }}
                >
                  {mode === 'sign-in' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
