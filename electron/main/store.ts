import ElectronStore from 'electron-store'

export type StoreSchema = { theme: 'dark' | 'light' | 'system'; agent_server_port: number }
export type AppStore = ElectronStore<StoreSchema>

export function createAppStore(): AppStore {
  return new ElectronStore<StoreSchema>({
    defaults: { theme: 'dark', agent_server_port: 53117 },
  })
}
