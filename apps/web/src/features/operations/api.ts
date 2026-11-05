import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  OrderCancelInput,
  PurchaseOrderCreateInput,
  PurchaseOrderCreateResult,
  PurchaseOrderDetail,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
  PurchaseOrderStatusResult,
  PurchaseReceiptInput,
  PurchaseReceiptResult,
  PurchaseReturnCreateInput,
  PurchaseReturnListResponse,
  ReturnCancelResult,
  ReturnCreateResult,
  ReturnPostResult,
  SalesOrderCancelResult,
  SalesOrderConfirmResult,
  SalesOrderCreateInput,
  SalesOrderCreateResult,
  SalesOrderDetail,
  SalesOrderFulfilResult,
  SalesOrderListResponse,
  SalesOrderStatus,
  SalesReturnCreateInput,
  SalesReturnListResponse,
  SupplierCreateInput,
  SupplierListResponse,
  SupplierSummary,
  SupplierUpdateInput,
} from '@mystock/contracts';

import { keepPreviousDataForOrganization } from '@/lib/organization-query-placeholder';
import { useAccessToken } from '@/features/auth/auth-provider';
import { useI18n } from '@/i18n/provider';
import { apiDownload, apiRequest, newIdempotencyKey } from '@/lib/api-client';

export interface SupplierFilters {
  search: string;
  isActive: '' | 'true' | 'false';
  page: number;
  pageSize: number;
}

export interface PurchaseOrderFilters {
  search: string;
  status: PurchaseOrderStatus | '';
  supplierId: string;
  page: number;
  pageSize: number;
}

export interface SalesOrderFilters {
  search: string;
  status: SalesOrderStatus | '';
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string) => ['organizations', organizationId] as const;

const idempotencyHeaders = () => ({ 'idempotency-key': newIdempotencyKey() });

export function useSuppliers(organizationId: string | null, filters: SupplierFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'suppliers', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.isActive) params.set('isActive', filters.isActive);

      return apiRequest<SupplierListResponse>(
        `/organizations/${organizationId}/suppliers?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function usePurchaseOrders(organizationId: string | null, filters: PurchaseOrderFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'purchase-orders', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.status) params.set('status', filters.status);
      if (filters.supplierId) params.set('supplierId', filters.supplierId);

      return apiRequest<PurchaseOrderListResponse>(
        `/organizations/${organizationId}/purchase-orders?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function usePurchaseOrder(organizationId: string | null, purchaseOrderId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'purchase-orders', purchaseOrderId],
    queryFn: () =>
      apiRequest<PurchaseOrderDetail>(
        `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(purchaseOrderId),
  });
}

export function useSalesOrders(organizationId: string | null, filters: SalesOrderFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'sales-orders', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.status) params.set('status', filters.status);

      return apiRequest<SalesOrderListResponse>(
        `/organizations/${organizationId}/sales-orders?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function useSalesOrder(organizationId: string | null, salesOrderId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'sales-orders', salesOrderId],
    queryFn: () =>
      apiRequest<SalesOrderDetail>(
        `/organizations/${organizationId}/sales-orders/${salesOrderId}`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(salesOrderId),
  });
}

function useOperationsMutation<TVariables, TResult>(
  organizationId: string,
  request: (variables: TVariables, token: string) => Promise<TResult>,
) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) => request(variables, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function useCreateSupplier(organizationId: string) {
  return useOperationsMutation<SupplierCreateInput, SupplierSummary>(
    organizationId,
    (input, token) =>
      apiRequest<SupplierSummary>(`/organizations/${organizationId}/suppliers`, {
        method: 'POST',
        token,
        body: input,
      }),
  );
}

export function useUpdateSupplier(organizationId: string) {
  return useOperationsMutation<{ supplierId: string; input: SupplierUpdateInput }, SupplierSummary>(
    organizationId,
    ({ supplierId, input }, token) =>
      apiRequest<SupplierSummary>(`/organizations/${organizationId}/suppliers/${supplierId}`, {
        method: 'PATCH',
        token,
        body: input,
      }),
  );
}

export function useSetSupplierActive(organizationId: string) {
  return useOperationsMutation<{ supplierId: string; isActive: boolean }, SupplierSummary>(
    organizationId,
    ({ supplierId, isActive }, token) =>
      apiRequest<SupplierSummary>(
        `/organizations/${organizationId}/suppliers/${supplierId}/activation`,
        { method: 'POST', token, body: { isActive } },
      ),
  );
}

export function useCreatePurchaseOrder(organizationId: string) {
  return useOperationsMutation<PurchaseOrderCreateInput, PurchaseOrderCreateResult>(
    organizationId,
    (input, token) =>
      apiRequest<PurchaseOrderCreateResult>(`/organizations/${organizationId}/purchase-orders`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useOrderPurchaseOrder(organizationId: string) {
  return useOperationsMutation<string, PurchaseOrderStatusResult>(
    organizationId,
    (purchaseOrderId, token) =>
      apiRequest<PurchaseOrderStatusResult>(
        `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/order`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useReceivePurchaseOrder(organizationId: string) {
  return useOperationsMutation<
    { purchaseOrderId: string; input: PurchaseReceiptInput },
    PurchaseReceiptResult
  >(organizationId, ({ purchaseOrderId, input }, token) =>
    apiRequest<PurchaseReceiptResult>(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/receipts`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function useCancelPurchaseOrder(organizationId: string) {
  return useOperationsMutation<
    { purchaseOrderId: string; input: OrderCancelInput },
    PurchaseOrderStatusResult
  >(organizationId, ({ purchaseOrderId, input }, token) =>
    apiRequest<PurchaseOrderStatusResult>(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/cancel`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function useCreateSalesOrder(organizationId: string) {
  return useOperationsMutation<SalesOrderCreateInput, SalesOrderCreateResult>(
    organizationId,
    (input, token) =>
      apiRequest<SalesOrderCreateResult>(`/organizations/${organizationId}/sales-orders`, {
        method: 'POST',
        token,
        body: input,
        headers: idempotencyHeaders(),
      }),
  );
}

export function useConfirmSalesOrder(organizationId: string) {
  return useOperationsMutation<string, SalesOrderConfirmResult>(
    organizationId,
    (salesOrderId, token) =>
      apiRequest<SalesOrderConfirmResult>(
        `/organizations/${organizationId}/sales-orders/${salesOrderId}/confirm`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useFulfilSalesOrder(organizationId: string) {
  return useOperationsMutation<string, SalesOrderFulfilResult>(
    organizationId,
    (salesOrderId, token) =>
      apiRequest<SalesOrderFulfilResult>(
        `/organizations/${organizationId}/sales-orders/${salesOrderId}/fulfil`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useCancelSalesOrder(organizationId: string) {
  return useOperationsMutation<
    { salesOrderId: string; input: OrderCancelInput },
    SalesOrderCancelResult
  >(organizationId, ({ salesOrderId, input }, token) =>
    apiRequest<SalesOrderCancelResult>(
      `/organizations/${organizationId}/sales-orders/${salesOrderId}/cancel`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function usePurchaseReturns(organizationId: string | null, purchaseOrderId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'purchase-returns', purchaseOrderId ?? ''],
    queryFn: () =>
      apiRequest<PurchaseReturnListResponse>(
        `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/returns?page=1&pageSize=50`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(purchaseOrderId),
  });
}

export function useCreatePurchaseReturn(organizationId: string) {
  return useOperationsMutation<
    { purchaseOrderId: string; input: PurchaseReturnCreateInput },
    ReturnCreateResult
  >(organizationId, ({ purchaseOrderId, input }, token) =>
    apiRequest<ReturnCreateResult>(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/returns`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function usePostPurchaseReturn(organizationId: string) {
  return useOperationsMutation<{ purchaseOrderId: string; returnId: string }, ReturnPostResult>(
    organizationId,
    ({ purchaseOrderId, returnId }, token) =>
      apiRequest<ReturnPostResult>(
        `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/returns/${returnId}/post`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useCancelPurchaseReturn(organizationId: string) {
  return useOperationsMutation<
    { purchaseOrderId: string; returnId: string; input: OrderCancelInput },
    ReturnCancelResult
  >(organizationId, ({ purchaseOrderId, returnId, input }, token) =>
    apiRequest<ReturnCancelResult>(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/returns/${returnId}/cancel`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function useDownloadPurchaseOrderPdf(organizationId: string) {
  const token = useAccessToken();
  const { locale } = useI18n();

  return (purchaseOrderId: string) =>
    apiDownload(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/pdf?locale=${locale}`,
      token,
    );
}

export function useDownloadPurchaseReturnPdf(organizationId: string) {
  const token = useAccessToken();
  const { locale } = useI18n();

  return (purchaseOrderId: string, returnId: string) =>
    apiDownload(
      `/organizations/${organizationId}/purchase-orders/${purchaseOrderId}/returns/${returnId}/pdf?locale=${locale}`,
      token,
    );
}

export function useSalesReturns(organizationId: string | null, salesOrderId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId ?? ''), 'sales-returns', salesOrderId ?? ''],
    queryFn: () =>
      apiRequest<SalesReturnListResponse>(
        `/organizations/${organizationId}/sales-orders/${salesOrderId}/returns?page=1&pageSize=50`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(salesOrderId),
  });
}

export function useCreateSalesReturn(organizationId: string) {
  return useOperationsMutation<
    { salesOrderId: string; input: SalesReturnCreateInput },
    ReturnCreateResult
  >(organizationId, ({ salesOrderId, input }, token) =>
    apiRequest<ReturnCreateResult>(
      `/organizations/${organizationId}/sales-orders/${salesOrderId}/returns`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}

export function usePostSalesReturn(organizationId: string) {
  return useOperationsMutation<{ salesOrderId: string; returnId: string }, ReturnPostResult>(
    organizationId,
    ({ salesOrderId, returnId }, token) =>
      apiRequest<ReturnPostResult>(
        `/organizations/${organizationId}/sales-orders/${salesOrderId}/returns/${returnId}/post`,
        { method: 'POST', token, headers: idempotencyHeaders() },
      ),
  );
}

export function useCancelSalesReturn(organizationId: string) {
  return useOperationsMutation<
    { salesOrderId: string; returnId: string; input: OrderCancelInput },
    ReturnCancelResult
  >(organizationId, ({ salesOrderId, returnId, input }, token) =>
    apiRequest<ReturnCancelResult>(
      `/organizations/${organizationId}/sales-orders/${salesOrderId}/returns/${returnId}/cancel`,
      { method: 'POST', token, body: input, headers: idempotencyHeaders() },
    ),
  );
}
