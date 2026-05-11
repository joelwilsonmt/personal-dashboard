/**
 * Home value provider — Phase 2 stub.
 * Manual path is Phase 1. Estimation APIs plug in here.
 */

export type HomeValueConfig =
  | { provider: 'none' }
  | { provider: 'zillapi'; apiKey: string }
  | { provider: 'rapidapi-zillow'; apiKey: string }

export const HOME_VALUE_ENABLED = false

// TODO(Phase 2): implement provider lookup
// export async function fetchHomeValue(address: string, config: HomeValueConfig): Promise<number | null>
