import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { Home, Plus, TrendingUp, Save, Trash2 } from 'lucide-react'
import { useMortgages, useProperties, useCreateMortgage, useCreateProperty, useAddHomeValue, useSaveRecurring, useDeleteMortgage } from '@/hooks/useMortgage'
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AmortizationChart } from '@/components/charts/AmortizationChart'
import {
  monthlyPayment,
  amortizationSchedule,
  comparePayoff,
  bpsToPercent,
  biweeklyExtraMonthly,
  type AmortizationRow,
} from '@/lib/mortgage'
import {
  formatCurrency,
  formatAbsoluteDate,
  formatPercent,
  displayToCents,
  centsToDisplay,
} from '@/lib/formatters'
import type { MortgageWithDetails, PropertyWithValue } from '@shared/types'
import { differenceInMonths } from 'date-fns'

export const Route = createFileRoute('/mortgage')({
  component: MortgagePage,
})

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function PropertyHero({ property, mortgage, currentBalance }: {
  property: PropertyWithValue | null
  mortgage: MortgageWithDetails | null
  currentBalance: number | null
}) {
  const [showUpdateValue, setShowUpdateValue] = useState(false)
  const addHomeValue = useAddHomeValue()
  const [valueInput, setValueInput] = useState('')

  const homeValue = property?.latest_value_cents ?? null
  const equity = homeValue != null && currentBalance != null ? homeValue - currentBalance : null

  function handleAddValue(e: React.FormEvent) {
    e.preventDefault()
    if (!property) return
    const cents = displayToCents(parseFloat(valueInput))
    addHomeValue.mutate(
      { property_id: property.id, value_cents: cents, source: 'manual' },
      {
        onSuccess: () => {
          toast.success('Home value updated')
          setShowUpdateValue(false)
          setValueInput('')
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (!property && !mortgage) return null

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Property</CardTitle>
          {property && (
            <Button size="sm" variant="outline" onClick={() => setShowUpdateValue(true)}>
              Update home value
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {property && <p className="text-xs text-muted-foreground mb-4">{property.address}</p>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Home Value</p>
              <p className="text-xl font-bold mt-0.5">
                {homeValue != null ? formatCurrency(homeValue) : '—'}
              </p>
              {property?.latest_value_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatAbsoluteDate(property.latest_value_at)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mortgage Balance</p>
              <p className="text-xl font-bold mt-0.5 text-red-400">
                {currentBalance != null ? formatCurrency(currentBalance) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Equity</p>
              <p className="text-xl font-bold mt-0.5 text-green-400">
                {equity != null ? formatCurrency(equity) : '—'}
              </p>
              {equity != null && homeValue != null && homeValue > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPercent((equity / homeValue) * 100)} LTV equity
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showUpdateValue && property && (
        <Dialog open onOpenChange={(open) => !open && setShowUpdateValue(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Home Value</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {property.address}. Home value estimates from any source are approximate — treat as guidance, not a market valuation.
            </p>
            <form onSubmit={handleAddValue} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="homeValue">Estimated value ($)</Label>
                <Input
                  id="homeValue"
                  type="number"
                  step="1000"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder={homeValue != null ? String(centsToDisplay(homeValue)) : '0'}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowUpdateValue(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addHomeValue.isPending || !valueInput}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function RefinanceCalculator({ mortgage, currentBalance }: {
  mortgage: MortgageWithDetails
  currentBalance: number | null
}) {
  const [newRate, setNewRate] = useState('')
  const [newTermYears, setNewTermYears] = useState('30')
  const [closingCosts, setClosingCosts] = useState('')

  const ratePct = bpsToPercent(mortgage.interest_rate_bps)
  const balance = currentBalance ?? mortgage.original_principal_cents
  const currentPaymentAmt = monthlyPayment(mortgage.original_principal_cents, ratePct, mortgage.term_months)
  const currentMonthIdx = Math.max(1, Math.min(
    differenceInMonths(new Date(), new Date(mortgage.start_date)) + 1,
    mortgage.term_months,
  ))
  const remainingMonths = Math.max(1, mortgage.term_months - currentMonthIdx + 1)

  const analysis = useMemo(() => {
    const rate = parseFloat(newRate)
    const termMonths = parseInt(newTermYears) * 12
    if (!rate || rate <= 0 || !termMonths) return null
    const costsCents = displayToCents(parseFloat(closingCosts || '0'))
    const newPaymentAmt = monthlyPayment(balance, rate, termMonths)
    const monthlySavings = currentPaymentAmt - newPaymentAmt
    const currentRemainingInterest = amortizationSchedule(balance, ratePct, remainingMonths)
      .reduce((s, r) => s + r.interest, 0)
    const newTotalInterest = amortizationSchedule(balance, rate, termMonths)
      .reduce((s, r) => s + r.interest, 0)
    const totalInterestSaved = currentRemainingInterest - newTotalInterest - costsCents
    const breakEvenMonths = monthlySavings > 0 ? Math.ceil(costsCents / monthlySavings) : null
    return { newPaymentAmt, monthlySavings, totalInterestSaved, breakEvenMonths }
  }, [newRate, newTermYears, closingCosts, balance, currentPaymentAmt, remainingMonths, ratePct])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Refinance Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>New rate (%)</Label>
            <Input
              type="number" step="0.001"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder={ratePct.toFixed(3)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>New term (years)</Label>
            <Input
              type="number"
              value={newTermYears}
              onChange={(e) => setNewTermYears(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Closing costs ($)</Label>
            <Input
              type="number" step="100"
              value={closingCosts}
              onChange={(e) => setClosingCosts(e.target.value)}
              placeholder="5000"
            />
          </div>
        </div>
        {analysis && (
          <div className="rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/40">
            <div>
              <p className="text-xs text-muted-foreground">New payment</p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(analysis.newPaymentAmt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly savings</p>
              <p className={`text-lg font-bold mt-0.5 ${analysis.monthlySavings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {analysis.monthlySavings >= 0 ? '+' : ''}{formatCurrency(analysis.monthlySavings)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest saved</p>
              <p className={`text-lg font-bold mt-0.5 ${analysis.totalInterestSaved >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {analysis.totalInterestSaved >= 0 ? '+' : ''}{formatCurrency(analysis.totalInterestSaved)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Break-even</p>
              <p className="text-lg font-bold mt-0.5">
                {analysis.breakEvenMonths != null ? `${analysis.breakEvenMonths} mo` : '—'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PayoffScenarios({ mortgage }: { mortgage: MortgageWithDetails }) {
  const [extraMonthly, setExtraMonthly] = useState(0)
  const [lumpSum, setLumpSum] = useState(0)
  const [biweekly, setBiweekly] = useState(false)
  const [appliedDate, setAppliedDate] = useState(new Date().toISOString().slice(0, 10))
  const saveRecurring = useSaveRecurring()

  const ratePct = bpsToPercent(mortgage.interest_rate_bps)
  const basePayment = monthlyPayment(
    mortgage.original_principal_cents,
    ratePct,
    mortgage.term_months,
  )

  const dExtraMonthly = useDebounce(extraMonthly, 200)
  const dLumpSum = useDebounce(lumpSum, 200)
  const dBiweekly = useDebounce(biweekly, 200)

  const baseSchedule = useMemo(
    () => amortizationSchedule(mortgage.original_principal_cents, ratePct, mortgage.term_months),
    [mortgage.original_principal_cents, ratePct, mortgage.term_months],
  )

  const extraPayments = useMemo(() => {
    const result = []
    const bwExtra = dBiweekly ? biweeklyExtraMonthly(basePayment) : 0
    const totalExtra = dExtraMonthly * 100 + bwExtra
    if (totalExtra > 0) {
      for (let m = 1; m <= mortgage.term_months; m++) {
        result.push({ month: m, amount: totalExtra })
      }
    }
    if (dLumpSum > 0) {
      const existing = result.find((r) => r.month === 1)
      if (existing) existing.amount += dLumpSum * 100
      else result.push({ month: 1, amount: dLumpSum * 100 })
    }
    return result
  }, [dExtraMonthly, dLumpSum, dBiweekly, basePayment, mortgage.term_months])

  const scenarioSchedule = useMemo(
    () =>
      amortizationSchedule(
        mortgage.original_principal_cents,
        ratePct,
        mortgage.term_months,
        extraPayments,
      ),
    [mortgage.original_principal_cents, ratePct, mortgage.term_months, extraPayments],
  )

  const comparison = useMemo(
    () => comparePayoff(baseSchedule, scenarioSchedule),
    [baseSchedule, scenarioSchedule],
  )

  const hasScenario = extraMonthly > 0 || lumpSum > 0 || biweekly

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Payoff Scenarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Extra monthly ($)</Label>
            <Input
              type="number"
              min="0"
              step="50"
              value={extraMonthly || ''}
              onChange={(e) => setExtraMonthly(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>One-time lump sum ($)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={lumpSum || ''}
              onChange={(e) => setLumpSum(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Biweekly payments</Label>
            <button
              type="button"
              onClick={() => setBiweekly((v) => !v)}
              className={`flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer ${
                biweekly
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-transparent text-muted-foreground hover:bg-accent'
              }`}
            >
              {biweekly ? 'Enabled' : 'Disabled'}
              <span className="text-xs opacity-70">
                (+{formatCurrency(biweeklyExtraMonthly(basePayment))}/mo)
              </span>
            </button>
          </div>
        </div>

        {hasScenario && (
          <div className="rounded-lg border border-border p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/40">
            <div>
              <p className="text-xs text-muted-foreground">Months saved</p>
              <p className="text-lg font-bold text-green-400 mt-0.5">
                {comparison.monthsSaved}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Years saved</p>
              <p className="text-lg font-bold text-green-400 mt-0.5">
                {(comparison.monthsSaved / 12).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest saved</p>
              <p className="text-lg font-bold text-green-400 mt-0.5">
                {formatCurrency(comparison.interestSaved)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">New payoff</p>
              <p className="text-lg font-bold mt-0.5">
                {comparison.newPayoffMonth} mo
              </p>
            </div>
          </div>
        )}
        {(extraMonthly > 0 || biweekly) && (
          <div className="flex items-center gap-3 justify-end">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Started</Label>
              <Input
                type="date"
                value={appliedDate}
                min={new Date(mortgage.start_date).toISOString().slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAppliedDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={saveRecurring.isPending}
              onClick={() =>
                saveRecurring.mutate(
                  {
                    mortgage_id: mortgage.id,
                    extra_monthly_cents: Math.round(extraMonthly * 100),
                    biweekly,
                    applied_date: appliedDate,
                  },
                  {
                    onSuccess: () => toast.success('Recurring payments saved'),
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
            >
              <Save size={13} />
              Save recurring payments
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MortgageDetail({ mortgage, currentBalance, homeValue }: {
  mortgage: MortgageWithDetails
  currentBalance: number | null
  homeValue?: number | null
}) {
  const ratePct = bpsToPercent(mortgage.interest_rate_bps)
  const balance = currentBalance ?? mortgage.original_principal_cents
  const paidOff = mortgage.original_principal_cents > 0
    ? Math.max(0, Math.round(((mortgage.original_principal_cents - balance) / mortgage.original_principal_cents) * 100))
    : 0
  const payment = monthlyPayment(mortgage.original_principal_cents, ratePct, mortgage.term_months)

  const baseSchedule = useMemo(
    () => amortizationSchedule(mortgage.original_principal_cents, ratePct, mortgage.term_months),
    [mortgage.original_principal_cents, ratePct, mortgage.term_months],
  )

  const scheduleWithExtras = useMemo(() => {
    const extraPaymentInputs = mortgage.extra_payments.flatMap((ep) => {
      const startMonth = Math.max(
        1,
        differenceInMonths(new Date(ep.applied_date), new Date(mortgage.start_date)) + 1,
      )
      if (ep.kind === 'extra_monthly') {
        return Array.from({ length: Math.max(0, mortgage.term_months - startMonth + 1) }, (_, i) => ({
          month: startMonth + i,
          amount: ep.amount_cents,
        }))
      }
      if (ep.kind === 'biweekly_conversion') {
        const biweeklyAmt = biweeklyExtraMonthly(payment)
        return Array.from({ length: Math.max(0, mortgage.term_months - startMonth + 1) }, (_, i) => ({
          month: startMonth + i,
          amount: biweeklyAmt,
        }))
      }
      return [{ month: startMonth, amount: ep.amount_cents }]
    })
    return amortizationSchedule(
      mortgage.original_principal_cents,
      ratePct,
      mortgage.term_months,
      extraPaymentInputs,
    )
  }, [mortgage.original_principal_cents, ratePct, mortgage.term_months, mortgage.extra_payments, mortgage.start_date, payment])

  const currentMonth = Math.max(
    1,
    Math.min(
      differenceInMonths(new Date(), new Date(mortgage.start_date)) + 1,
      mortgage.term_months,
    ),
  )

  const ytdStartIndex = useMemo(() => {
    const jan1 = new Date(new Date().getFullYear(), 0, 1)
    return Math.max(0, differenceInMonths(jan1, new Date(mortgage.start_date)))
  }, [mortgage.start_date])

  const interestYTD = useMemo(() =>
    scheduleWithExtras.slice(ytdStartIndex, currentMonth).reduce((s, r) => s + r.interest, 0),
    [scheduleWithExtras, ytdStartIndex, currentMonth],
  )

  const principalYTD = useMemo(() =>
    scheduleWithExtras.slice(ytdStartIndex, currentMonth).reduce((s, r) => s + r.principal, 0),
    [scheduleWithExtras, ytdStartIndex, currentMonth],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Payoff Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Balance: {formatCurrency(balance)}</span>
            <span className="text-muted-foreground">{paidOff}% paid off</span>
          </div>
          <Progress value={paidOff} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Original: {formatCurrency(mortgage.original_principal_cents)} · Started {formatAbsoluteDate(mortgage.start_date)}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Payment', value: formatCurrency(payment) },
          { label: 'Interest YTD', value: formatCurrency(interestYTD) },
          { label: 'Principal YTD', value: formatCurrency(principalYTD) },
          { label: 'Rate', value: `${ratePct.toFixed(3)}%` },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-0.5 tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Amortization</CardTitle>
        </CardHeader>
        <CardContent>
          <AmortizationChart schedule={scheduleWithExtras} currentMonth={currentMonth} height={260} />
        </CardContent>
      </Card>

      <PayoffScenarios mortgage={mortgage} />

      <RefinanceCalculator mortgage={mortgage} currentBalance={currentBalance} />

      {(() => {
        const pmiBase = homeValue ?? mortgage.original_principal_cents
        if (!pmiBase) return null
        const pmiThreshold = pmiBase * 0.8
        const ltv = balance / pmiBase
        if (ltv <= 0.8) return null
        const removalRow = baseSchedule.find((r) => r.balance <= pmiThreshold)
        const removalMonth = removalRow?.month ?? null
        const monthsLeft = removalMonth != null ? Math.max(0, removalMonth - currentMonth) : null
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">PMI Tracker</CardTitle>
                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/40">Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current LTV</p>
                  <p className="text-lg font-bold mt-0.5 text-amber-400">{formatPercent(ltv * 100)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PMI removal at</p>
                  <p className="text-lg font-bold mt-0.5">80% LTV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Balance ≤ {formatCurrency(pmiThreshold)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estimated removal</p>
                  <p className="text-lg font-bold mt-0.5">
                    {monthsLeft != null ? `${monthsLeft} mo` : '—'}
                  </p>
                  {removalMonth != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">month {removalMonth}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                You can request PMI cancellation once your balance reaches 80% LTV. Lenders are required to auto-cancel at 78% LTV.
              </p>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}

type NewMortgageForm = {
  accountName: string
  principal: string
  rate: string
  termYears: string
  startDate: string
  paymentDay: string
}

function SetupMortgage() {
  const createAccount = useCreateAccount()
  const createMortgage = useCreateMortgage()
  const createProperty = useCreateProperty()
  const [step, setStep] = useState<'choose' | 'mortgage' | 'property'>('choose')
  const [form, setForm] = useState<NewMortgageForm>({
    accountName: 'Home Mortgage',
    principal: '',
    rate: '',
    termYears: '30',
    startDate: new Date().toISOString().slice(0, 10),
    paymentDay: '1',
  })
  const [propertyForm, setPropertyForm] = useState({
    address: '',
    purchasePrice: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      const account = await createAccount.mutateAsync({
        name: form.accountName,
        kind: 'liability',
        type: 'mortgage',
        institution: '',
        initial_balance_cents: displayToCents(parseFloat(form.principal)),
      })

      let propertyId: string | null = null
      if (step === 'property' && propertyForm.address) {
        const prop = await createProperty.mutateAsync({
          address: propertyForm.address,
          purchase_price_cents: displayToCents(parseFloat(propertyForm.purchasePrice || '0')),
          purchase_date: propertyForm.purchaseDate,
        })
        propertyId = prop.id
      }

      await createMortgage.mutateAsync({
        account_id: account.id,
        property_id: propertyId,
        original_principal_cents: displayToCents(parseFloat(form.principal)),
        interest_rate_bps: Math.round(parseFloat(form.rate) * 100),
        term_months: parseInt(form.termYears) * 12,
        start_date: form.startDate,
        payment_day_of_month: parseInt(form.paymentDay),
      })

      toast.success('Mortgage added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add mortgage')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <Home size={40} className="text-muted-foreground" />
      <h2 className="text-lg font-semibold">No mortgage set up yet</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Add your mortgage details to see payoff progress, amortization, and scenario analysis.
      </p>

      <Dialog open={step !== 'choose'} onOpenChange={(open) => !open && setStep('choose')}>
        <Button onClick={() => setStep('mortgage')} className="gap-2">
          <Plus size={14} />
          Add Mortgage
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Mortgage</DialogTitle>
          </DialogHeader>
          <Tabs value={step === 'property' ? 'property' : 'mortgage'}>
            <TabsList className="w-full">
              <TabsTrigger value="mortgage" className="flex-1" onClick={() => setStep('mortgage')}>Mortgage</TabsTrigger>
              <TabsTrigger value="property" className="flex-1" onClick={() => setStep('property')}>+ Property</TabsTrigger>
            </TabsList>
            <form onSubmit={handleCreate}>
              <TabsContent value="mortgage" className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label>Account name</Label>
                  <Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Principal ($)</Label>
                    <Input type="number" value={form.principal} onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value }))} placeholder="400000" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rate (%)</Label>
                    <Input type="number" step="0.001" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder="6.5" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Term (years)</Label>
                    <Input type="number" value={form.termYears} onChange={(e) => setForm((f) => ({ ...f, termYears: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment day</Label>
                    <Input type="number" min="1" max="28" value={form.paymentDay} onChange={(e) => setForm((f) => ({ ...f, paymentDay: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
                </div>
              </TabsContent>
              <TabsContent value="property" className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={propertyForm.address} onChange={(e) => setPropertyForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City, ST 12345" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Purchase price ($)</Label>
                    <Input type="number" value={propertyForm.purchasePrice} onChange={(e) => setPropertyForm((f) => ({ ...f, purchasePrice: e.target.value }))} placeholder="450000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Purchase date</Label>
                    <Input type="date" value={propertyForm.purchaseDate} onChange={(e) => setPropertyForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Property details are optional. You can add them later in settings.</p>
              </TabsContent>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setStep('choose')}>Cancel</Button>
                <Button type="submit" disabled={createMortgage.isPending || !form.principal || !form.rate}>
                  Add Mortgage
                </Button>
              </DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MortgagePage() {
  const mortgagesQ = useMortgages()
  const propertiesQ = useProperties()
  const accountsQ = useAccounts()
  const deleteMortgage = useDeleteMortgage()

  const mortgages = mortgagesQ.data ?? []
  const properties = propertiesQ.data ?? []
  const accounts = accountsQ.data ?? []

  const [selectedMortgageId, setSelectedMortgageId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const mortgage = selectedMortgageId
    ? (mortgages.find((m) => m.id === selectedMortgageId) ?? mortgages[0] ?? null)
    : (mortgages[0] ?? null)

  const mortgageAccount = mortgage
    ? accounts.find((a) => a.id === mortgage.account_id)
    : null
  const currentBalance = mortgageAccount?.latest_balance_cents ?? null

  const property = mortgage?.property_id
    ? (properties.find((p) => p.id === mortgage.property_id) ?? null)
    : (properties[0] ?? null)

  const isLoading = mortgagesQ.isLoading || propertiesQ.isLoading || accountsQ.isLoading

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (mortgagesQ.isError || propertiesQ.isError || accountsQ.isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Failed to load mortgage data</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mortgage</h1>
          {mortgages.length > 1 && (
            <div className="flex gap-2 mt-2">
              {mortgages.map((m) => {
                const acct = accounts.find((a) => a.id === m.account_id)
                return (
                  <Badge
                    key={m.id}
                    variant={m.id === mortgage?.id ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedMortgageId(m.id)}
                  >
                    {acct?.name ?? m.id}
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mortgage && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} />
              Delete mortgage
            </Button>
          )}
          <TrendingUp size={20} className="text-muted-foreground" />
        </div>
      </div>

      {mortgages.length === 0 ? (
        <SetupMortgage />
      ) : (
        <>
          <PropertyHero
            property={property}
            mortgage={mortgage}
            currentBalance={currentBalance}
          />
          {mortgage && (
            <MortgageDetail
              mortgage={mortgage}
              currentBalance={currentBalance}
              homeValue={property?.latest_value_cents ?? property?.purchase_price_cents ?? null}
            />
          )}
        </>
      )}

      {confirmDelete && mortgage && (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this mortgage?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the mortgage and all extra payment history. The linked account in Net Worth won't be affected. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteMortgage.mutate(mortgage.id, {
                    onSuccess: () => {
                      toast.success('Mortgage deleted')
                      setConfirmDelete(false)
                      setSelectedMortgageId(null)
                    },
                    onError: (err) => toast.error(err.message),
                  })
                }
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
