import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type {
  CustomerCreateInput,
  CustomerListResponse,
  CustomerSummary,
  CustomerUpdateInput,
  PaymentStatus,
  SalesInvoiceCreateInput,
  SalesInvoiceCreateResult,
  SalesInvoiceDetail,
  SalesInvoiceListResponse,
  SalesInvoicePaymentCreateInput,
  SalesInvoicePaymentResult,
} from '@mystock/contracts';

import { useAccessToken } from '@/features/auth/auth-provider';
import { apiDownload, apiRequest, newIdempotencyKey } from '@/lib/api-client';
import { keepPreviousDataForOrganization } from '@/lib/organization-query-placeholder';

export interface CustomerFilters {
  search: string;
  isActive: '' | 'true' | 'false';
  page: number;
  pageSize: number;
}

export interface SalesInvoiceFilters {
  search: string;
  paymentStatus: PaymentStatus | '';
  page: number;
  pageSize: number;
}

const organizationKey = (organizationId: string | null) =>
  ['organizations', organizationId ?? ''] as const;

/**
 * One idempotency key per attempt, kept until it lands: a double click or a retry
 * after a dropped connection replays the original sale or payment instead of
 * posting a second one. The key is rotated only once the server has answered.
 */
export function useRetrySafeIdempotencyKey(): { key: string; rotate: () => void } {
  const [key, setKey] = useState(newIdempotencyKey);
  const rotate = useCallback(() => setKey(newIdempotencyKey()), []);
  return { key, rotate };
}

function useInvoicingMutation<TInput, TResult>(
  organizationId: string,
  request: (input: TInput, token: string) => Promise<TResult>,
) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => request(input, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function useCustomers(organizationId: string | null, filters: CustomerFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'customers', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.isActive) params.set('isActive', filters.isActive);

      return apiRequest<CustomerListResponse>(
        `/organizations/${organizationId}/customers?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function useCreateCustomer(organizationId: string) {
  return useInvoicingMutation<CustomerCreateInput, CustomerSummary>(
    organizationId,
    (input, token) =>
      apiRequest<CustomerSummary>(`/organizations/${organizationId}/customers`, {
        method: 'POST',
        token,
        body: input,
      }),
  );
}

export function useUpdateCustomer(organizationId: string) {
  const token = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, input }: { customerId: string; input: CustomerUpdateInput }) =>
      apiRequest<CustomerSummary>(`/organizations/${organizationId}/customers/${customerId}`, {
        method: 'PATCH',
        token,
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKey(organizationId) }),
  });
}

export function useSetCustomerActive(organizationId: string) {
  return useInvoicingMutation<{ customerId: string; isActive: boolean }, CustomerSummary>(
    organizationId,
    ({ customerId, isActive }, token) =>
      apiRequest<CustomerSummary>(
        `/organizations/${organizationId}/customers/${customerId}/activation`,
        { method: 'POST', token, body: { isActive } },
      ),
  );
}

export function useSalesInvoices(organizationId: string | null, filters: SalesInvoiceFilters) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'sales-invoices', filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);

      return apiRequest<SalesInvoiceListResponse>(
        `/organizations/${organizationId}/sales-invoices?${params.toString()}`,
        { token },
      );
    },
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousDataForOrganization(organizationId),
  });
}

export function useSalesInvoice(organizationId: string | null, invoiceId: string | null) {
  const token = useAccessToken();

  return useQuery({
    queryKey: [...organizationKey(organizationId), 'sales-invoices', invoiceId],
    queryFn: () =>
      apiRequest<SalesInvoiceDetail>(
        `/organizations/${organizationId}/sales-invoices/${invoiceId}`,
        { token },
      ),
    enabled: Boolean(organizationId) && Boolean(invoiceId),
  });
}

/**
 * Posting the sale is the moment stock leaves the depot: the RPC creates the
 * order, reserves, issues and fulfils it, and disposes the devices, in one
 * transaction. Nothing here mutates the ledger directly.
 */
export function usePostSale(organizationId: string) {
  return useInvoicingMutation<
    { input: SalesInvoiceCreateInput; idempotencyKey: string },
    SalesInvoiceCreateResult
  >(organizationId, ({ input, idempotencyKey }, token) =>
    apiRequest<SalesInvoiceCreateResult>(`/organizations/${organizationId}/sales-invoices`, {
      method: 'POST',
      token,
      body: input,
      headers: { 'idempotency-key': idempotencyKey },
    }),
  );
}

export function useRecordInvoicePayment(organizationId: string) {
  return useInvoicingMutation<
    { invoiceId: string; input: SalesInvoicePaymentCreateInput; idempotencyKey: string },
    SalesInvoicePaymentResult
  >(organizationId, ({ invoiceId, input, idempotencyKey }, token) =>
    apiRequest<SalesInvoicePaymentResult>(
      `/organizations/${organizationId}/sales-invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        token,
        body: input,
        headers: { 'idempotency-key': idempotencyKey },
      },
    ),
  );
}

export function useDownloadInvoicePdf(organizationId: string) {
  const token = useAccessToken();

  return (invoiceId: string) =>
    apiDownload(`/organizations/${organizationId}/sales-invoices/${invoiceId}/pdf`, token);
}

export function useDownloadIssueNotePdf(organizationId: string) {
  const token = useAccessToken();

  return (invoiceId: string) =>
    apiDownload(
      `/organizations/${organizationId}/sales-invoices/${invoiceId}/issue-note/pdf`,
      token,
    );
}
