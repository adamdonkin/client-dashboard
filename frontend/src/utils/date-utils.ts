import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export const formatLastSessionDate = (date?: Date) => {
  if (!date) return "N/A";
  return format(date, "MMM d, yyyy");
}

export const formatRelativeDate = (dateString: string) => {
  if (!dateString) return "Not scheduled";
  const date = parseISO(dateString);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}