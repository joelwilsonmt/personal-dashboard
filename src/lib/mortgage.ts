export type AmortizationRow = {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
  extraPayment: number
}

export type ExtraPaymentInput = {
  month: number
  amount: number
}

/**
 * Standard monthly payment using amortization formula.
 * All amounts in cents.
 */
export function monthlyPayment(
  principalCents: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (annualRatePct === 0) return Math.round(principalCents / termMonths)
  const r = annualRatePct / 100 / 12
  return Math.round((principalCents * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1))
}

/**
 * Full amortization schedule with optional extra payments.
 * Extra payments are applied in the month they hit, reducing balance before interest.
 */
export function amortizationSchedule(
  principalCents: number,
  annualRatePct: number,
  termMonths: number,
  extraPayments: ExtraPaymentInput[] = [],
): AmortizationRow[] {
  const r = annualRatePct === 0 ? 0 : annualRatePct / 100 / 12
  const basePayment = monthlyPayment(principalCents, annualRatePct, termMonths)
  const extraByMonth = new Map<number, number>(extraPayments.map((ep) => [ep.month, ep.amount]))

  const rows: AmortizationRow[] = []
  let balance = principalCents

  for (let month = 1; month <= termMonths; month++) {
    if (balance <= 0) break

    const extra = extraByMonth.get(month) ?? 0
    const interestCharge = Math.round(balance * r)
    // On the last scheduled month, pay off exactly the remaining balance
    const isLastMonth = month === termMonths
    const principalPart = isLastMonth
      ? balance
      : Math.min(balance, basePayment - interestCharge + extra)
    const actualPayment = interestCharge + principalPart

    rows.push({
      month,
      payment: actualPayment,
      principal: principalPart,
      interest: interestCharge,
      balance: Math.max(0, balance - principalPart),
      extraPayment: extra,
    })

    balance = Math.max(0, balance - principalPart)
  }

  return rows
}

export type PayoffComparison = {
  monthsSaved: number
  interestSaved: number
  newPayoffMonth: number
  originalPayoffMonth: number
}

export function comparePayoff(
  base: AmortizationRow[],
  scenario: AmortizationRow[],
): PayoffComparison {
  const baseInterest = base.reduce((s, r) => s + r.interest, 0)
  const scenarioInterest = scenario.reduce((s, r) => s + r.interest, 0)
  return {
    originalPayoffMonth: base.length,
    newPayoffMonth: scenario.length,
    monthsSaved: base.length - scenario.length,
    interestSaved: baseInterest - scenarioInterest,
  }
}

export function bpsToPercent(bps: number): number {
  return bps / 100
}

export function percentToBps(pct: number): number {
  return Math.round(pct * 100)
}

/**
 * Biweekly conversion: 26 half-payments/year = 13 full payments.
 * Returns extra monthly amount equivalent.
 */
export function biweeklyExtraMonthly(basePaymentCents: number): number {
  return Math.round(basePaymentCents / 12)
}
