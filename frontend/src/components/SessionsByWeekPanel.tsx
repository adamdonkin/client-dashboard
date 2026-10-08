'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PANEL_MOBILE_CLASS, panelSlideClass, useDismissiblePanel } from '@/lib/dismissiblePanel'
import { addDays, averageCompleted, fetchSessionsByWeek, mondayOf, pacificToday, weekLabel } from '@/lib/sessionsByWeek'

type Range = '12' | '26' | 'ytd'
type CompareMode = 'prev' | 'month' | 'avg'

interface WeekStats {
  key: string
  label: string
  completed: number
  scheduled: number
  cancelled: number
  current: boolean
}

const RANGES: { value: Range; label: string }[] = [
  { value: '12', label: '12 wks' },
  { value: '26', label: '6 mo' },
  { value: 'ytd', label: String(new Date().getFullYear()) },
]

const COMPARE_LABELS: Record<CompareMode, string> = {
  prev: 'Previous week',
  month: '4 weeks earlier',
  avg: 'Range average',
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function SessionsByWeekPanel({ onClose }: { onClose: () => void }) {
  const supabase = createClientComponentClient()
  const { panelRef, closing, requestClose } = useDismissiblePanel<HTMLDivElement>(onClose)
  const [weeks, setWeeks] = useState<WeekStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('12')
  const [compare, setCompare] = useState<CompareMode>('prev')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [currentMonday, setCurrentMonday] = useState('')

  useEffect(() => {
    const load = async () => {
      const currentMonday = mondayOf(pacificToday())
      const yearStart = mondayOf(`${currentMonday.slice(0, 4)}-01-01`)
      const sixMonths = addDays(currentMonday, -26 * 7)
      const { weeks: rows, error } = await fetchSessionsByWeek(supabase, yearStart < sixMonths ? yearStart : sixMonths)

      if (error) {
        console.error('Error loading sessions by week:', error)
        setError('Could not load sessions. Close the panel and try again.')
        setLoading(false)
        return
      }

      setCurrentMonday(currentMonday)
      setWeeks(rows.map(r => ({
        key: r.week_start,
        label: weekLabel(r.week_start),
        completed: r.completed,
        scheduled: r.scheduled,
        cancelled: r.cancelled,
        current: r.week_start === currentMonday,
      })))
      setSelectedKey(currentMonday)
      setLoading(false)
    }
    load()
  }, [supabase])

  const visible = useMemo(() => {
    if (range === 'ytd') {
      const year = weeks.length ? weeks[weeks.length - 1].key.slice(0, 4) : ''
      const firstOfYear = mondayOf(`${year}-01-01`)
      return weeks.filter(w => w.key >= firstOfYear)
    }
    return weeks.slice(-(Number(range) + 1))
  }, [weeks, range])

  const fullWeeks = visible.filter(w => !w.current)
  const avgCompleted = averageCompleted(visible.map(w => ({ week_start: w.key, ...w })), currentMonday)
  const avgCancelled = fullWeeks.length ? fullWeeks.reduce((sum, w) => sum + w.cancelled, 0) / fullWeeks.length : 0

  const selectedIndex = weeks.findIndex(w => w.key === selectedKey)
  const selected = selectedIndex >= 0 ? weeks[selectedIndex] : null
  const firstVisibleIndex = visible.length ? weeks.indexOf(visible[0]) : 0

  const changeRange = (next: Range) => {
    setRange(next)
    const nextVisible = next === 'ytd' ? null : weeks.slice(-(Number(next) + 1))
    if (nextVisible && selected && !nextVisible.includes(selected)) {
      setSelectedKey(weeks[weeks.length - 1]?.key ?? null)
    }
  }

  const baseline = (() => {
    if (!selected) return null
    if (compare === 'avg') return { completed: avgCompleted, cancelled: avgCancelled, label: 'avg' }
    const other = weeks[selectedIndex - (compare === 'prev' ? 1 : 4)]
    return other ? { completed: other.completed, cancelled: other.cancelled, label: `wk of ${other.label}` } : null
  })()

  const maxTotal = Math.max(1, ...visible.map(w => w.completed + w.scheduled + w.cancelled))
  const yMax = Math.ceil((maxTotal + 1) / 2) * 2
  const labelEvery = Math.max(1, Math.ceil(visible.length / 6))

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-0 right-0 z-50 h-full w-[560px] max-w-full bg-background border-l border-border shadow-xl flex flex-col',
        PANEL_MOBILE_CLASS,
        panelSlideClass(closing),
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border/50 shrink-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-foreground">Sessions by week</h2>
          {!loading && !error && fullWeeks.length > 0 && (
            <p className="text-[12px] text-muted-foreground">
              {formatNumber(avgCompleted)} completed per week on average, last {fullWeeks.length} full weeks
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Range">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => changeRange(r.value)}
                aria-pressed={range === r.value}
                className={cn(
                  'px-2.5 py-1 text-[13px] rounded-md transition-colors',
                  range === r.value
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={requestClose}
            className="p-2 -mr-1 sm:p-1 sm:mr-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Close"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-[14px] text-danger py-8 text-center">{error}</p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Completed</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />Still scheduled</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger/60" />Cancelled</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 border-t border-dashed border-muted-foreground" />Average</span>
              </div>

              <div className="flex gap-2">
                <div className="relative w-5 h-48 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  <span className="absolute right-0 top-0 -translate-y-1/2">{yMax}</span>
                  <span className="absolute right-0 top-1/2 -translate-y-1/2">{yMax / 2}</span>
                  <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="relative h-48 border-b border-border">
                    <div className="absolute inset-x-0 top-0 border-t border-border/50" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-border/50" />
                    {fullWeeks.length > 0 && (
                      <div
                        className="absolute inset-x-0 border-t border-dashed border-muted-foreground pointer-events-none z-10"
                        style={{ bottom: `${(avgCompleted / yMax) * 100}%` }}
                      >
                        <span className="absolute right-0 -top-4 text-[11px] text-muted-foreground bg-background/80 px-1">
                          avg {formatNumber(avgCompleted)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-end">
                      {visible.map(w => {
                        const isSelected = w.key === selectedKey
                        return (
                          <button
                            key={w.key}
                            onClick={() => setSelectedKey(w.key)}
                            title={`Week of ${w.label}: ${w.completed} completed${w.scheduled ? `, ${w.scheduled} scheduled` : ''}${w.cancelled ? `, ${w.cancelled} cancelled` : ''}`}
                            aria-label={`Week of ${w.label}`}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex-1 h-full flex items-end justify-center rounded-sm transition-colors',
                              isSelected ? 'bg-muted' : 'hover:bg-muted/50',
                            )}
                          >
                            <div className="w-[70%] max-w-6 flex flex-col-reverse">
                              {w.completed > 0 && <div className="bg-primary" style={{ height: `${(w.completed / yMax) * 192}px` }} />}
                              {w.scheduled > 0 && <div className="bg-primary/25 border-t border-background" style={{ height: `${(w.scheduled / yMax) * 192}px` }} />}
                              {w.cancelled > 0 && <div className="bg-danger/60 border-t border-background" style={{ height: `${(w.cancelled / yMax) * 192}px` }} />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex mt-1.5 text-[11px] text-muted-foreground">
                    {visible.map((w, i) => (
                      <span key={w.key} className="flex-1 text-center whitespace-nowrap overflow-visible">
                        {(visible.length - 1 - i) % labelEvery === 0 ? w.label : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {selected && (
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 -ml-2">
                    <button
                      onClick={() => setSelectedKey(weeks[selectedIndex - 1]?.key ?? selectedKey)}
                      disabled={selectedIndex <= firstVisibleIndex}
                      className="p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[14px] font-medium text-foreground min-w-[160px] text-center">
                      Week of {selected.label}{selected.current ? ' (this week)' : ''}
                    </span>
                    <button
                      onClick={() => setSelectedKey(weeks[selectedIndex + 1]?.key ?? selectedKey)}
                      disabled={selectedIndex >= weeks.length - 1}
                      className="p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      aria-label="Next week"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    Compare to
                    <Select value={compare} onValueChange={(v) => setCompare(v as CompareMode)}>
                      <SelectTrigger className="h-8 w-[150px] text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(COMPARE_LABELS) as CompareMode[]).map(mode => (
                          <SelectItem key={mode} value={mode}>{COMPARE_LABELS[mode]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-[14px] text-foreground tabular-nums leading-relaxed">
                  <Metric
                    value={selected.scheduled ? `${selected.completed} of ${selected.completed + selected.scheduled}` : String(selected.completed)}
                    label="completed"
                    current={selected.completed}
                    base={baseline?.completed}
                    higherIsBetter
                  />
                  <span className="text-muted-foreground"> · </span>
                  <Metric
                    value={String(selected.cancelled)}
                    label="cancelled"
                    current={selected.cancelled}
                    base={baseline?.cancelled}
                    higherIsBetter={false}
                  />
                  {!baseline && <span className="text-muted-foreground"> · no earlier week to compare</span>}
                </p>
                {baseline && (
                  <p className="text-[12px] text-muted-foreground">Compared with {baseline.label}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ value, label, current, base, higherIsBetter }: {
  value: string
  label: string
  current: number
  base?: number
  higherIsBetter: boolean
}) {
  if (base === undefined) return <span>{value} {label}</span>
  const diff = Math.round((current - base) * 10) / 10
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±'
  const tone = diff === 0 ? 'text-muted-foreground' : (diff > 0) === higherIsBetter ? 'text-success' : 'text-danger'
  return (
    <span>
      {value} {label}{' '}
      <span className="text-muted-foreground">(</span>
      <span className={tone}>{sign}{formatNumber(Math.abs(diff))}</span>
      <span className="text-muted-foreground"> vs {formatNumber(base)})</span>
    </span>
  )
}
