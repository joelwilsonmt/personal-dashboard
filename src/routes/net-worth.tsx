import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, RefreshCw, Building2, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { useAccounts, useCreateAccount, useUpdateAccount, useUpdateBalances, useNetWorthTrend, useAccountHistory } from '@/hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NetWorthTrend } from '@/components/charts/NetWorthTrend'
import { formatCurrency, formatDelta, formatRelativeTime, displayToCents, centsToDisplay } from '@/lib/formatters'
import type { Account } from '@shared/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const Route = createFileRoute('/net-worth')({
  component: NetWorthPage,
})

function computeSummary(accounts: Account[]) {
  let assets = 0
  let liabilities = 0
  for (const a of accounts) {
    const b = a.latest_balance_cents ?? 0
    if (a.kind === 'asset') assets += b
    else liabilities += b
  }
  return { assets, liabilities, netWorth: assets - liabilities }
}

function SourceIcon({ source }: { source: 'manual' | 'plaid' | null }) {
  if (!source) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40 ml-1 cursor-default" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs capitalize">{source} entry</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AccountRow({ account, onClick }: { account: Account; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Building2 size={14} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">{account.institution || account.type}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">
          {account.latest_balance_cents != null
            ? formatCurrency(account.latest_balance_cents)
            : '—'}
          <SourceIcon source={account.latest_balance_source} />
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
          <Clock size={10} />
          {formatRelativeTime(account.latest_balance_at)}
        </p>
      </div>
    </button>
  )
}

function AccountDrawer({ account, onClose }: { account: Account; onClose: () => void }) {
  const historyQ = useAccountHistory(account.id)
  const updateAccount = useUpdateAccount()

  function handleArchive() {
    updateAccount.mutate(
      { id: account.id, is_archived: true },
      {
        onSuccess: () => {
          toast.success(`${account.name} archived`)
          onClose()
        },
      },
    )
  }

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{account.name}</DrawerTitle>
          <p className="text-sm text-muted-foreground">{account.institution || account.type}</p>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4 overflow-auto">
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
              <p className="text-xl font-bold">
                {account.latest_balance_cents != null
                  ? formatCurrency(account.latest_balance_cents)
                  : '—'}
              </p>
            </div>
            <div className="flex-1 rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
              <p className="text-sm font-medium">{formatRelativeTime(account.latest_balance_at)}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Balance History</h3>
            {historyQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !historyQ.data || historyQ.data.snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {historyQ.data.snapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(s.recorded_at)}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium tabular-nums">
                        {formatCurrency(s.balance_cents)}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize">{s.source}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />
          <Button
            variant="destructive"
            size="sm"
            onClick={handleArchive}
            disabled={updateAccount.isPending}
          >
            Archive account
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

type AddAccountForm = {
  name: string
  kind: 'asset' | 'liability'
  type: string
  institution: string
  initial_balance: string
}

function AddAccountDialog({ onClose }: { onClose: () => void }) {
  const createAccount = useCreateAccount()
  const [form, setForm] = useState<AddAccountForm>({
    name: '',
    kind: 'asset',
    type: 'checking',
    institution: '',
    initial_balance: '0',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cents = displayToCents(parseFloat(form.initial_balance || '0'))
    createAccount.mutate(
      {
        name: form.name,
        kind: form.kind,
        type: form.type as Account['type'],
        institution: form.institution,
        initial_balance_cents: cents,
      },
      {
        onSuccess: () => {
          toast.success(`${form.name} added`)
          onClose()
        },
        onError: (err) => toast.error(`Failed to add account: ${err.message}`),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Account name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Chase Checking"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as 'asset' | 'liability' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="brokerage">Brokerage</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="institution">Institution</Label>
            <Input
              id="institution"
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              placeholder="Chase Bank"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="balance">Starting balance ($)</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={form.initial_balance}
              onChange={(e) => setForm((f) => ({ ...f, initial_balance: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAccount.isPending || !form.name}>
              Add Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UpdateBalancesDialog({
  accounts,
  onClose,
}: {
  accounts: Account[]
  onClose: () => void
}) {
  const updateBalances = useUpdateBalances()
  const manualAccounts = accounts.filter((a) => !a.plaid_account_id)
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      manualAccounts.map((a) => [
        a.id,
        a.latest_balance_cents != null ? String(centsToDisplay(a.latest_balance_cents)) : '',
      ]),
    ),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const updates = manualAccounts
      .filter((a) => values[a.id] !== '')
      .map((a) => ({
        account_id: a.id,
        balance_cents: displayToCents(parseFloat(values[a.id] ?? '0')),
      }))
    updateBalances.mutate(
      { updates },
      {
        onSuccess: ({ updated }) => {
          toast.success(`Updated ${updated} balance${updated !== 1 ? 's' : ''}`)
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Balances</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3 max-h-96 overflow-y-auto py-1">
            {manualAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No manual accounts to update
              </p>
            ) : (
              manualAccounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.institution || a.type}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={values[a.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                    className="w-32 text-right tabular-nums"
                    placeholder="0.00"
                  />
                </div>
              ))
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateBalances.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NetWorthPage() {
  const accountsQ = useAccounts()
  const trendQ = useNetWorthTrend(12)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showUpdateBalances, setShowUpdateBalances] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  const accounts = accountsQ.data ?? []
  const { assets, liabilities, netWorth } = computeSummary(accounts)
  const assetList = accounts.filter((a) => a.kind === 'asset')
  const liabilityList = accounts.filter((a) => a.kind === 'liability')

  const trendData = trendQ.data ?? []
  const prevMonthNW = trendData.length >= 2 ? trendData[trendData.length - 2]?.net_worth_cents ?? null : null
  const delta = prevMonthNW != null ? netWorth - prevMonthNW : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Net Worth</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All your accounts in one place</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpdateBalances(true)}
            className="gap-2"
          >
            <RefreshCw size={14} />
            Update balances
          </Button>
          <Button size="sm" onClick={() => setShowAddAccount(true)} className="gap-2">
            <Plus size={14} />
            Add account
          </Button>
        </div>
      </div>

      {/* Hero + metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            {accountsQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Net Worth</p>
                <p className="text-4xl font-bold mt-1 tabular-nums">
                  {formatCurrency(netWorth)}
                </p>
                {delta != null && (
                  <p className={`text-sm mt-1.5 tabular-nums ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatDelta(delta)} vs last month
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {accountsQ.isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <div className="flex items-center gap-2 text-green-500 mb-1">
                  <TrendingUp size={16} />
                  <p className="text-sm font-medium">Total Assets</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-green-500">
                  {formatCurrency(assets)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {accountsQ.isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <TrendingDown size={16} />
                  <p className="text-sm font-medium">Total Liabilities</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-red-500">
                  {formatCurrency(liabilities)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp size={16} />
              <p className="text-sm font-medium">Savings Rate</p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">Available with Plaid (Phase 2)</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">12-Month Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <NetWorthTrend data={trendQ.data ?? []} height={192} />
          )}
        </CardContent>
      </Card>

      {/* Account lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Assets</CardTitle>
              <Badge variant="outline" className="text-xs">{assetList.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-2">
            {accountsQ.isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : assetList.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p>No asset accounts yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowAddAccount(true)}
                  className="mt-1"
                >
                  Add your first account
                </Button>
              </div>
            ) : (
              <ul>
                {assetList.map((a) => (
                  <li key={a.id}>
                    <AccountRow account={a} onClick={() => setSelectedAccount(a)} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Liabilities</CardTitle>
              <Badge variant="outline" className="text-xs">{liabilityList.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 mt-2">
            {accountsQ.isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : liabilityList.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p>No liability accounts yet</p>
              </div>
            ) : (
              <ul>
                {liabilityList.map((a) => (
                  <li key={a.id}>
                    <AccountRow account={a} onClick={() => setSelectedAccount(a)} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs & drawers */}
      {showAddAccount && <AddAccountDialog onClose={() => setShowAddAccount(false)} />}
      {showUpdateBalances && (
        <UpdateBalancesDialog
          accounts={accounts}
          onClose={() => setShowUpdateBalances(false)}
        />
      )}
      {selectedAccount && (
        <AccountDrawer account={selectedAccount} onClose={() => setSelectedAccount(null)} />
      )}
    </div>
  )
}
