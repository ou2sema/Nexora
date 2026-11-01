import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  BrandCreateInput,
  BrandSummary,
  CategoryCreateInput,
  CategorySummary,
  ProductCreateInput,
  ProductListResponse,
  ProductStatus,
  ProductSummary,
  ProductUpdateInput,
  StorageLocationCreateInput,
  StorageLocationSummary,
  WarehouseCreateInput,
  WarehouseSummary,
} from '@mystock/contracts';

import { keepPreviousDataForOrganization } from '@/lib/organization-query-placeholder';
import { useAccessToken } from '@/features/auth/auth-provider';
import { apiRequest } from '@/lib/api-client';

export interface ProductFilters {
  search: string;
  status: ProductStatus | '';
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string) => ['organizations', organizationId] as const;

function productQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

export function useProducts(organizationId: string | null, filters: ProductFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'products', filters],
    queryFn: () =>
      apiRequest<ProductListResponse>(
        `/organizations/${organizationId}/products?${productQueryString(filters)}`,
        { token },
      ),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function useCategories(organizationId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'categories'],
    queryFn: () =>
      apiRequest<CategorySummary[]>(`/organizations/${organizationId}/categories`, { token }),
    enabled: Boolean(organizationId),
  });
}

export function useBrands(organizationId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'brands'],
    queryFn: () => apiRequest<BrandSummary[]>(`/organizations/${organizationId}/brands`, { token }),
    enabled: Boolean(organizationId),
  });
}

export function useWarehouses(organizationId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'warehouses'],
    queryFn: () =>
      apiRequest<WarehouseSummary[]>(`/organizations/${organizationId}/warehouses`, { token }),
    enabled: Boolean(organizationId),
  });
}

function useCatalogMutation<TInput, TResult>(
  organizationId: string,
  path: string,
  method: 'POST' | 'PATCH',
) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) =>
      apiRequest<TResult>(`/organizations/${organizationId}${path}`, {
        method,
        token,
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function useCreateProduct(organizationId: string) {
  return useCatalogMutation<ProductCreateInput, ProductSummary>(
    organizationId,
    '/products',
    'POST',
  );
}

export function useUpdateProduct(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ProductUpdateInput }) =>
      apiRequest<ProductSummary>(`/organizations/${organizationId}/products/${productId}`, {
        method: 'PATCH',
        token,
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function useCreateCategory(organizationId: string) {
  return useCatalogMutation<CategoryCreateInput, CategorySummary>(
    organizationId,
    '/categories',
    'POST',
  );
}

export function useCreateBrand(organizationId: string) {
  return useCatalogMutation<BrandCreateInput, BrandSummary>(organizationId, '/brands', 'POST');
}

export function useCreateWarehouse(organizationId: string) {
  return useCatalogMutation<WarehouseCreateInput, WarehouseSummary>(
    organizationId,
    '/warehouses',
    'POST',
  );
}

export function useCreateLocation(organizationId: string, warehouseId: string) {
  return useCatalogMutation<StorageLocationCreateInput, StorageLocationSummary>(
    organizationId,
    `/warehouses/${warehouseId}/locations`,
    'POST',
  );
}
