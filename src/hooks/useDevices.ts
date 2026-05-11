import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Device, DeviceMetric } from '@shared/types'

export const deviceKeys = {
  all: ['devices'] as const,
  history: (id: string) => ['deviceHistory', id] as const,
}

export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.all,
    queryFn: () => window.api.devices.list() as Promise<Device[]>,
    refetchInterval: 15_000,
  })
}

export function useDeviceHistory(deviceId: string | null, limit = 200) {
  return useQuery({
    queryKey: deviceKeys.history(deviceId ?? ''),
    queryFn: () =>
      window.api.devices.getHistory({ device_id: deviceId!, limit }) as Promise<DeviceMetric[]>,
    enabled: !!deviceId,
    staleTime: 30_000,
    refetchInterval: 30_000,
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
