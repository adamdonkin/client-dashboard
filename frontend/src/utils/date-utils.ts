import { format } from 'date-fns';

export const formatLastSessionDate = (date?: Date) => {
  if (!date) return "N/A";
  return format(date, "MMM d, yyyy");
}