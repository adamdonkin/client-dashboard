'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { addDays, pacificToday } from '@/lib/sessionsByWeek'
import { cn } from '@/lib/utils'

interface ActionDatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  defaultOpen?: boolean
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 weeks', days: 14 },
]

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined
  const dateStr = value.length > 10 ? value.slice(0, 10) : value
  return parseISO(`${dateStr}T12:00:00`)
}

export function ActionDatePicker({
  value,
  onChange,
  className,
  placeholder = 'Set date',
  defaultOpen = false,
}: ActionDatePickerProps) {
  const [open, setOpen] = useState(defaultOpen)
  const selected = parseDateValue(value)
  const selectedValue = selected ? format(selected, 'yyyy-MM-dd') : null

  const pick = (date: string) => {
    onChange(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-[13px] text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground border border-border/50 rounded px-1.5 py-0.5 bg-transparent',
            className
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          {selected ? format(selected, 'MMM d') : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex gap-1 p-2 border-b border-border/50">
          {PRESETS.map(preset => {
            const date = addDays(pacificToday(), preset.days)
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => pick(date)}
                className={cn(
                  'flex-1 whitespace-nowrap text-[13px] px-2 py-1 rounded-md cursor-pointer transition-colors',
                  selectedValue === date ? 'bg-foreground text-background' : 'hover:bg-accent',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) pick(format(date, 'yyyy-MM-dd'))
          }}
          defaultMonth={selected ?? new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
