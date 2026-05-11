import { describe, it, expect } from 'vitest'
import {
  monthlyPayment,
  amortizationSchedule,
  comparePayoff,
  bpsToPercent,
  biweeklyExtraMonthly,
} from './mortgage'

describe('monthlyPayment', () => {
  it('computes standard payment for 300k @ 6.5% 30yr', () => {
    const payment = monthlyPayment(30_000_000, 6.5, 360)
    // ~$1,896.20 = 189620 cents
    expect(payment).toBeGreaterThan(189_000)
    expect(payment).toBeLessThan(191_000)
  })

  it('handles zero interest rate', () => {
    expect(monthlyPayment(120_000_00, 0, 120)).toBe(100_000)
  })

  it('returns positive value for any positive input', () => {
    expect(monthlyPayment(10_000_00, 5, 60)).toBeGreaterThan(0)
  })
})

describe('amortizationSchedule', () => {
  it('first month interest is principal * rate / 12', () => {
    const schedule = amortizationSchedule(30_000_000, 6.0, 360)
    const first = schedule[0]
    expect(first).toBeDefined()
    const expectedInterest = Math.round((30_000_000 * 0.06) / 12)
    expect(first!.interest).toBe(expectedInterest)
  })

  it('balance reaches zero by end of term', () => {
    const schedule = amortizationSchedule(20_000_000, 5.0, 240)
    const last = schedule[schedule.length - 1]
    expect(last!.balance).toBe(0)
  })

  it('extra payments reduce the schedule length', () => {
    const base = amortizationSchedule(30_000_000, 6.0, 360)
    const withExtra = amortizationSchedule(30_000_000, 6.0, 360, [{ month: 1, amount: 100_000 }])
    expect(withExtra.length).toBeLessThan(base.length)
  })

  it('sum of principal equals original loan amount', () => {
    const schedule = amortizationSchedule(10_000_000, 4.0, 120)
    const totalPrincipal = schedule.reduce((s, r) => s + r.principal, 0)
    // Within $1 of the original amount
    expect(Math.abs(totalPrincipal - 10_000_000)).toBeLessThan(100)
  })
})

describe('comparePayoff', () => {
  it('returns zero months saved when schedules are equal', () => {
    const s = amortizationSchedule(10_000_000, 5.0, 120)
    const result = comparePayoff(s, s)
    expect(result.monthsSaved).toBe(0)
    expect(result.interestSaved).toBe(0)
  })

  it('extra payment saves months and interest', () => {
    const base = amortizationSchedule(30_000_000, 6.0, 360)
    const scenario = amortizationSchedule(30_000_000, 6.0, 360, [
      { month: 1, amount: 100_000 },
    ])
    const result = comparePayoff(base, scenario)
    expect(result.monthsSaved).toBeGreaterThan(0)
    expect(result.interestSaved).toBeGreaterThan(0)
  })
})

describe('monthlyPayment edge cases', () => {
  it('handles 1-month term', () => {
    const payment = monthlyPayment(100_00, 5, 1)
    expect(payment).toBeGreaterThan(100_00)
    expect(payment).toBeLessThan(101_00)
  })
})

describe('amortizationSchedule edge cases', () => {
  it('returns empty array for zero principal', () => {
    expect(amortizationSchedule(0, 5, 360)).toHaveLength(0)
  })
})

describe('comparePayoff edge cases', () => {
  it('returns zero values when no scenario is active (same schedule)', () => {
    const s = amortizationSchedule(10_000_000, 5.0, 120)
    const r = comparePayoff(s, s)
    expect(r.monthsSaved).toBe(0)
    expect(r.interestSaved).toBe(0)
    expect(r.newPayoffMonth).toBe(r.originalPayoffMonth)
  })
})

describe('bpsToPercent', () => {
  it('converts 650bps to 6.5%', () => {
    expect(bpsToPercent(650)).toBe(6.5)
  })
})

describe('biweeklyExtraMonthly', () => {
  it('returns ~1/12 of monthly payment', () => {
    const extra = biweeklyExtraMonthly(189_620)
    expect(extra).toBeCloseTo(15_802, 0)
  })
})
