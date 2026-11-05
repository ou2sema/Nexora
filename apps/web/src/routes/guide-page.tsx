import {
  AlertTriangle,
  Boxes,
  BookOpen,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogIn,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';

interface GuideSection {
  id: string;
  icon: LucideIcon;
  title: MessageKey;
  purpose: MessageKey;
  steps: MessageKey[];
  watch?: MessageKey;
  to?: string;
}

const guideSections: GuideSection[] = [
  {
    id: 'sign-in',
    icon: LogIn,
    title: 'guide.signin.title',
    purpose: 'guide.signin.purpose',
    steps: ['guide.signin.step1', 'guide.signin.step2', 'guide.signin.step3'],
    watch: 'guide.signin.watch',
    to: '/sign-in',
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'guide.dashboard.title',
    purpose: 'guide.dashboard.purpose',
    steps: [
      'guide.dashboard.step1',
      'guide.dashboard.step2',
      'guide.dashboard.step3',
      'guide.dashboard.step4',
    ],
    watch: 'guide.dashboard.watch',
    to: '/',
  },
  {
    id: 'sale',
    icon: ReceiptText,
    title: 'guide.sale.title',
    purpose: 'guide.sale.purpose',
    steps: [
      'guide.sale.step1',
      'guide.sale.step2',
      'guide.sale.step3',
      'guide.sale.step4',
      'guide.sale.step5',
    ],
    watch: 'guide.sale.watch',
    to: '/sale',
  },
  {
    id: 'scan',
    icon: ScanLine,
    title: 'guide.scan.title',
    purpose: 'guide.scan.purpose',
    steps: ['guide.scan.step1', 'guide.scan.step2', 'guide.scan.step3', 'guide.scan.step4'],
    watch: 'guide.scan.watch',
    to: '/scan',
  },
  {
    id: 'stock',
    icon: Boxes,
    title: 'guide.stock.title',
    purpose: 'guide.stock.purpose',
    steps: ['guide.stock.step1', 'guide.stock.step2', 'guide.stock.step3', 'guide.stock.step4'],
    watch: 'guide.stock.watch',
    to: '/stock',
  },
  {
    id: 'orders',
    icon: ClipboardList,
    title: 'guide.orders.title',
    purpose: 'guide.orders.purpose',
    steps: ['guide.orders.step1', 'guide.orders.step2', 'guide.orders.step3', 'guide.orders.step4'],
    watch: 'guide.orders.watch',
    to: '/orders',
  },
  {
    id: 'documents',
    icon: FileText,
    title: 'guide.documents.title',
    purpose: 'guide.documents.purpose',
    steps: [
      'guide.documents.step1',
      'guide.documents.step2',
      'guide.documents.step3',
      'guide.documents.step4',
    ],
    watch: 'guide.documents.watch',
  },
  {
    id: 'roles',
    icon: ShieldCheck,
    title: 'guide.roles.title',
    purpose: 'guide.roles.purpose',
    steps: ['guide.roles.step1', 'guide.roles.step2', 'guide.roles.step3', 'guide.roles.step4'],
    watch: 'guide.roles.watch',
  },
  {
    id: 'rules',
    icon: BookOpen,
    title: 'guide.rules.title',
    purpose: 'guide.rules.purpose',
    steps: [
      'guide.rules.step1',
      'guide.rules.step2',
      'guide.rules.step3',
      'guide.rules.step4',
      'guide.rules.step5',
      'guide.rules.step6',
    ],
  },
];

export function GuidePage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('guide.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('guide.description')}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm leading-6 text-slate-700">{t('guide.intro')}</p>
      </section>

      <nav aria-label={t('guide.toc')} className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">{t('guide.toc')}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {guideSections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
              >
                <section.icon aria-hidden="true" className="size-4 shrink-0" />
                {t(section.title)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {guideSections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6"
        >
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                <section.icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">{t(section.title)}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {t(section.purpose)}
                </p>
              </div>
            </div>
            {section.to && (
              <Link
                to={section.to}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
              >
                {t('guide.openScreen')}
                {/* A route starts with a slash, which bidi reorders inside an RTL run. */}
                <bdi dir="ltr">{section.to}</bdi>
              </Link>
            )}
          </header>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('guide.howTo')}
              </h3>
              <ol className="mt-2 list-decimal space-y-2 ps-5 text-sm leading-6 text-slate-700">
                {section.steps.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ol>
            </div>

            {section.watch && (
              <div className="rounded-lg bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  <AlertTriangle aria-hidden="true" className="size-4" />
                  {t('guide.watchOut')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-amber-900">{t(section.watch)}</p>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
