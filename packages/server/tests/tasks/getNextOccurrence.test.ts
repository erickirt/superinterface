import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getNextOccurrence } from '../../src/lib/tasks/getNextOccurrence'

describe('getNextOccurrence', () => {
  describe('one-shot schedule (no recurrenceRules)', () => {
    it('returns start when start is in the future', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: { start: future },
      })
      assert.equal(result, future)
    })

    it('returns null when start is in the past and no duration', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: { start: past },
      })
      assert.equal(result, null)
    })
  })

  describe('continuous schedule (start + duration, no recurrenceRules)', () => {
    it('returns now when within the duration window', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString() // 1 min ago
      const now = new Date()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'PT1H' }, // 1 hour duration
        now,
      })
      assert.ok(result)
      // Result should be approximately now
      const resultTime = new Date(result!).getTime()
      const nowTime = now.getTime()
      assert.ok(
        Math.abs(resultTime - nowTime) < 2000,
        'Result should be within 2 seconds of now',
      )
    })

    it('returns null when past the duration window', () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'PT1H' }, // 1 hour duration — expired 1 hour ago
      })
      assert.equal(result, null)
    })

    it('returns start when start is in the future even with duration', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: { start: future, duration: 'PT10H' },
      })
      assert.equal(result, future)
    })

    it('works with long durations (P10Y)', () => {
      const past = new Date(
        Date.now() - 365 * 24 * 60 * 60 * 1000,
      ).toISOString() // 1 year ago
      const now = new Date()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'P10Y' }, // 10 year duration
        now,
      })
      assert.ok(result)
      const resultTime = new Date(result!).getTime()
      const nowTime = now.getTime()
      assert.ok(Math.abs(resultTime - nowTime) < 2000)
    })

    it('works with short durations (PT30S)', () => {
      const past = new Date(Date.now() - 10 * 1000).toISOString() // 10 seconds ago
      const now = new Date()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'PT30S' }, // 30 second duration
        now,
      })
      assert.ok(result)
    })

    it('returns null for expired short duration', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString() // 1 min ago
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'PT30S' }, // 30 second duration — expired
      })
      assert.equal(result, null)
    })

    it('works with P1D (1 day) duration', () => {
      const past = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
      const now = new Date()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'P1D' }, // 1 day duration
        now,
      })
      assert.ok(result)
    })

    it('ignores duration when recurrenceRules are present', () => {
      // When recurrenceRules exist, duration should not affect the behavior
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: {
          start: past,
          duration: 'P10Y',
          recurrenceRules: [{ frequency: 'daily' }],
        },
      })
      // Should return next daily occurrence, not be affected by duration
      assert.ok(result)
      const resultTime = new Date(result!).getTime()
      // Should be in the future (next daily occurrence)
      assert.ok(resultTime > Date.now())
    })
  })

  describe('recurring schedule', () => {
    it('returns next occurrence for daily frequency', () => {
      const past = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: {
          start: past,
          recurrenceRules: [{ frequency: 'daily' }],
        },
      })
      assert.ok(result)
      assert.ok(new Date(result!).getTime() > Date.now())
    })

    it('returns next occurrence for hourly frequency', () => {
      const past = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: {
          start: past,
          recurrenceRules: [{ frequency: 'hourly' }],
        },
      })
      assert.ok(result)
      assert.ok(new Date(result!).getTime() > Date.now())
    })

    it('respects interval', () => {
      const past = new Date(Date.now() - 90 * 60 * 1000).toISOString() // 90 min ago
      const result = getNextOccurrence({
        schedule: {
          start: past,
          recurrenceRules: [{ frequency: 'hourly', interval: 2 }],
        },
      })
      assert.ok(result)
      // Should be ~30 min from now (2h interval - 90min elapsed = 30min left)
      const resultTime = new Date(result!).getTime()
      assert.ok(resultTime > Date.now())
    })
  })

  describe('edge cases', () => {
    it('returns null for null schedule', () => {
      const result = getNextOccurrence({ schedule: null as any })
      assert.equal(result, null)
    })

    it('returns null for non-object schedule', () => {
      const result = getNextOccurrence({ schedule: 'invalid' as any })
      assert.equal(result, null)
    })

    it('returns null for missing start', () => {
      const result = getNextOccurrence({ schedule: {} as any })
      assert.equal(result, null)
    })

    it('returns null for invalid start date', () => {
      const result = getNextOccurrence({
        schedule: { start: 'not-a-date' } as any,
      })
      assert.equal(result, null)
    })

    it('returns null for invalid duration string', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 'invalid' } as any,
      })
      // dayjs.duration('invalid') returns a duration of 0, so end = start
      // Since now > start + 0, should return null
      assert.equal(result, null)
    })

    it('handles duration that is not a string gracefully', () => {
      const past = new Date(Date.now() - 60 * 1000).toISOString()
      const result = getNextOccurrence({
        schedule: { start: past, duration: 12345 } as any,
      })
      // duration is not a string, should be ignored — returns null (past start, no recurrence)
      assert.equal(result, null)
    })
  })
})
