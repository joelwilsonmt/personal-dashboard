import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const siteKeys = {
  all: ['sites'] as const,
  checks: (siteId: string) => ['siteChecks', siteId] as const,
}

export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: () => window.api.sites.list(),
    refetchInterval: 30_000,
  })
}

export function useSiteChecks(siteId: string) {
  return useQuery({
    queryKey: siteKeys.checks(siteId),
    queryFn: () => window.api.sites.getChecks({ site_id: siteId, limit: 200 }),
    enabled: !!siteId,
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.sites.create>[0]) =>
      window.api.sites.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  })
}

export function useUpdateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.sites.update>[0]) =>
      window.api.sites.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  })
}

export function useDeleteSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.sites.delete({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  })
}
