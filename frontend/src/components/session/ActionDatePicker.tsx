'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ActionDatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  defaultOpen?: boolean
}

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-ui-base text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground border border-border/50 rounded px-1.5 py-0.5 bg-transparent',
            className
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          {selected ? format(selected, 'MMM d') : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'))
              setOpen(false)
            }
          }}
          defaultMonth={selected ?? new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
