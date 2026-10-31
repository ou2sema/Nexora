import { zodResolver } from '@hookform/resolvers/zod';
import { Tags } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { BrandSummary, CategorySummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  useBrands,
  useCategories,
  useCreateBrand,
  useCreateCategory,
} from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useI18n } from '@/i18n/provider';

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500';

type CategoryValues = { name: string; parentId: string };
type BrandValues = { name: string };

export function CatalogSettingsPage() {
  const { t } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const categories = useCategories(organizationId);
  const brands = useBrands(organizationId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('catalogSettings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t('catalogSettings.description')}</p>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('catalogSettings.readOnly')}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">
              {t('catalogSettings.categories.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('catalogSettings.categories.description')}
            </p>
          </div>

          {canWrite && organizationId && (
            <CategoryForm organizationId={organizationId} categories={categories.data ?? []} />
          )}

          <CategoryList
            isLoading={categories.isPending}
            isError={categories.isError}
            categories={categories.data ?? []}
            onRetry={() => void categories.refetch()}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">
              {t('catalogSettings.brands.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t('catalogSettings.brands.description')}</p>
          </div>

          {canWrite && organizationId && <BrandForm organizationId={organizationId} />}

          <BrandList
            isLoading={brands.isPending}
            isError={brands.isError}
            brands={brands.data ?? []}
            onRetry={() => void brands.refetch()}
          />
        </section>
      </div>
    </div>
  );
}

function CategoryForm({
  organizationId,
  categories,
}: {
  organizationId: string;
  categories: CategorySummary[];
}) {
  const { t, errorMessage } = useI18n();
  const mutation = useCreateCategory(organizationId);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('catalogSettings.categories.nameRequired')).max(120),
        parentId: z.string(),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', parentId: '' },
  });

  const error = mutation.error
    ? errorMessage(mutation.error, 'catalogSettings.categories.failed')
    : null;

  return (
    <form
      noValidate
      className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-5"
      onSubmit={handleSubmit(async (values) => {
        try {
          await mutation.mutateAsync({
            name: values.name,
            parentId: values.parentId || null,
          });
          reset();
        } catch {
          // mutation.error renders below.
        }
      })}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category-name" className="block text-sm font-medium text-slate-700">
            {t('catalogSettings.categories.new')}
          </label>
          <input
            id="category-name"
            className={fieldClass}
            placeholder={t('catalogSettings.categories.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'category-name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <p id="category-name-error" role="alert" className="mt-1 text-xs text-rose-700">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="category-parent" className="block text-sm font-medium text-slate-700">
            {t('catalogSettings.categories.parent')}
          </label>
          <select id="category-parent" className={fieldClass} {...register('parentId')}>
            <option value="">{t('catalogSettings.categories.topLevel')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t('catalogSettings.adding') : t('catalogSettings.categories.create')}
      </Button>
    </form>
  );
}

function BrandForm({ organizationId }: { organizationId: string }) {
  const { t, errorMessage } = useI18n();
  const mutation = useCreateBrand(organizationId);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('catalogSettings.brands.nameRequired')).max(120),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrandValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const error = mutation.error
    ? errorMessage(mutation.error, 'catalogSettings.brands.failed')
    : null;

  return (
    <form
      noValidate
      className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-5"
      onSubmit={handleSubmit(async (values) => {
        try {
          await mutation.mutateAsync({ name: values.name });
          reset();
        } catch {
          // mutation.error renders below.
        }
      })}
    >
      <div>
        <label htmlFor="brand-name" className="block text-sm font-medium text-slate-700">
          {t('catalogSettings.brands.new')}
        </label>
        <input
          id="brand-name"
          className={fieldClass}
          placeholder={t('catalogSettings.brands.namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'brand-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="brand-name-error" role="alert" className="mt-1 text-xs text-rose-700">
            {errors.name.message}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? t('catalogSettings.adding') : t('catalogSettings.brands.create')}
      </Button>
    </form>
  );
}

function CategoryList({
  categories,
  isLoading,
  isError,
  onRetry,
}: {
  categories: CategorySummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div
        className="space-y-3 p-5"
        role="status"
        aria-label={t('catalogSettings.categories.loading')}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-5">
        <p role="alert" className="text-sm text-rose-700">
          {t('catalogSettings.categories.loadFailed')}
        </p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-slate-600">
        <Tags aria-hidden="true" className="size-4 text-slate-400" />
        {t('catalogSettings.categories.empty')}
      </p>
    );
  }

  const names = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <ul className="divide-y divide-slate-100">
      {categories.map((category) => (
        <li key={category.id} className="flex items-center justify-between px-5 py-3 text-sm">
          <div>
            <p className="font-medium text-slate-800">{category.name}</p>
            <p className="text-xs text-slate-500">
              {category.parentId
                ? t('catalogSettings.categories.inside', {
                    name: names.get(category.parentId) ?? t('catalogSettings.categories.unknown'),
                  })
                : t('catalogSettings.categories.topLevel')}
            </p>
          </div>
          <span dir="ltr" className="font-mono text-xs text-slate-500">
            {category.slug}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BrandList({
  brands,
  isLoading,
  isError,
  onRetry,
}: {
  brands: BrandSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="space-y-3 p-5" role="status" aria-label={t('catalogSettings.brands.loading')}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-5">
        <p role="alert" className="text-sm text-rose-700">
          {t('catalogSettings.brands.loadFailed')}
        </p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-slate-600">
        <Tags aria-hidden="true" className="size-4 text-slate-400" />
        {t('catalogSettings.brands.empty')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {brands.map((brand) => (
        <li key={brand.id} className="px-5 py-3 text-sm font-medium text-slate-800">
          {brand.name}
        </li>
      ))}
    </ul>
  );
}
