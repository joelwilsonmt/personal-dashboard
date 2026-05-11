import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Device } from '@shared/types'

export const deviceKeys = {
  all: ['devices'] as const,
}

export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.all,
    queryFn: () => window.api.devices.list() as Promise<Device[]>,
    refetchInterval: 15_000,
  })
}

export function useCreateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.devices.create>[0]) =>
      window.api.devices.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
  })
}

export function useDeleteDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.devices.delete({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
  })
}
