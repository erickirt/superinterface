import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import duration from 'dayjs/plugin/duration'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)

type TaskSchedule = PrismaJson.TaskSchedule
type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

const freqUnit: Record<string, Unit> = {
  secondly: 'second',
  minutely: 'minute',
  hourly: 'hour',
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fits = (d: dayjs.Dayjs, r: any) =>
  (!r.byMonth || r.byMonth.includes(d.month() + 1)) &&
  (!r.byDay || r.byDay.includes(d.format('dd').toUpperCase())) &&
  (!r.byHour || r.byHour.includes(d.hour())) &&
  (!r.byMinute || r.byMinute.includes(d.minute())) &&
  (!r.bySecond || r.bySecond.includes(d.second()))

export const getNextOccurrence = ({
  schedule,
  now = new Date(),
}: {
  schedule: TaskSchedule
  now?: Date
}): string | null => {
  if (!schedule || typeof schedule !== 'object') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { start, timeZone = 'UTC', recurrenceRules = [] } = schedule as any
  if (typeof start !== 'string') return null

  if (!dayjs(start).isValid()) return null
  const hasOffset = /([+-]\d\d:\d\d|Z)$/i.test(start)
  const base = hasOffset ? dayjs(start).tz(timeZone) : dayjs.tz(start, timeZone)
  const cursor = dayjs.tz(now, timeZone).add(1, 'second')

  if (recurrenceRules.length === 0) {
    if (base.isAfter(cursor)) return base.toISOString()

    // Continuous task: start + duration defines the active window.
    // If we're still within it, fire immediately (return now).
    const { duration: dur } = schedule as Record<string, unknown>
    if (typeof dur === 'string') {
      const end = base.add(dayjs.duration(dur))
      if (dayjs.tz(now, timeZone).isBefore(end)) {
        return dayjs.tz(now, timeZone).toISOString()
      }
    }

    return null
  }

  let best: dayjs.Dayjs | null = null

  for (const r of recurrenceRules) {
    const unit = freqUnit[r.frequency]
    if (!unit) continue
    const interval = Math.max(1, r.interval ?? 1)

    let next = base
    if (next.isBefore(cursor)) {
      const diff = cursor.diff(base, unit)
      const steps = Math.floor(diff / interval)
      next = base.add(steps * interval, unit)
      while (next.isBefore(cursor)) next = next.add(interval, unit)
    }

    let guard = 0
    while (!fits(next, r) && guard < 5000) {
      next = next.add(interval, unit)
      guard++
    }

    if (r.until && next.isAfter(dayjs.tz(r.until, timeZone))) continue
    if (r.count && base.add(interval * r.count, unit).isBefore(next)) continue

    if (!best || next.isBefore(best)) best = next
  }

  return best ? best.toISOString() : null
}
