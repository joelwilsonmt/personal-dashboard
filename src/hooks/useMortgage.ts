import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const mortgageKeys = {
  all: ['mortgages'] as const,
  properties: ['properties'] as const,
}

export function useMortgages() {
  return useQuery({
    queryKey: mortgageKeys.all,
    queryFn: () => window.api.mortgages.list(),
  })
}

export function useProperties() {
  return useQuery({
    queryKey: mortgageKeys.properties,
    queryFn: () => window.api.properties.list(),
  })
}

export function useHomeValueHistory(propertyId: string | null) {
  return useQuery({
    queryKey: ['homeValueHistory', propertyId],
    queryFn: () => window.api.properties.homeValueHistory({ property_id: propertyId! }),
    enabled: !!propertyId,
  })
}

export function useCreateMortgage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.mortgages.create>[0]) =>
      window.api.mortgages.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: mortgageKeys.all }),
  })
}

export function useAddHomeValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.properties.addHomeValue>[0]) =>
      window.api.properties.addHomeValue(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: mortgageKeys.properties })
      void qc.invalidateQueries({ queryKey: ['homeValueHistory'] })
    },
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.properties.create>[0]) =>
      window.api.properties.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: mortgageKeys.properties }),
  })
}

export function useUpsertExtraPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof window.api.mortgages.upsertExtraPayment>[0]) =>
      window.api.mortgages.upsertExtraPayment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: mortgageKeys.all }),
  })
}
