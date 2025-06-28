import { format, parseISO } from 'date-fns'

export function formatLastSessionDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
    return format(date, 'MMM d, yyyy')
  } catch (error) {
    return 'Invalid date'
  }
}

export function formatRelativeDate(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
    return format(date, 'EEE, MMM d')
  } catch (error) {
    return 'Invalid date'
  }
} 