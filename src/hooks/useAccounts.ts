import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Account } from '@shared/types'

export const accountKeys = {
  all: ['accounts'] as const,
  list: (kind?: 'asset' | 'liability') => [...accountKeys.all, 'list', kind] as const,
  history: (id: string) => [...accountKeys.all, 'history', id] as const,
  trend: (months: number) => ['netWorthTrend', months] as const,
}

export function useAccounts(kind?: 'asset' | 'liability') {
  return useQuery({
    queryKey: accountKeys.list(kind),
    queryFn: () => window.api.accounts.list({ kind }) as Promise<Account[]>,
  })
}

export function useAccountHistory(id: string) {
  return useQuery({
    queryKey: accountKeys.history(id),
    queryFn: () => window.api.accounts.getHistory({ id }),
    enabled: !!id,
  })
}

export function useNetWorthTrend(months = 12) {
  return useQuery({
    queryKey: accountKeys.trend(months),
    queryFn: () => window.api.netWorth.trend({ months }),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.accounts.create>[0]) =>
      window.api.accounts.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.accounts.update>[0]) =>
      window.api.accounts.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  })
}

export function useUpdateBalances() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { updates: { account_id: string; balance_cents: number }[] }) =>
      window.api.balances.update(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountKeys.all })
      void qc.invalidateQueries({ queryKey: ['netWorthTrend'] })
    },
  })
}
