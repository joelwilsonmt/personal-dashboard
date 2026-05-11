import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const settingsKeys = {
  all: ['settings'] as const,
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => window.api.settings.get(),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.settings.update>[0]) =>
      window.api.settings.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}
