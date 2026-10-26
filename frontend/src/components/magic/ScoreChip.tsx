import { cn } from '@/lib/utils'

const SCORE_CLASS: Record<number, string> = {
  5: 'bg-success/20 text-success',
  4: 'bg-success/10 text-success',
  3: 'bg-warning/15 text-warning',
  2: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  1: 'bg-danger/15 text-danger',
}

export function ScoreChip({ score, lowest, title }: { score: number | null; lowest?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded text-[11px] font-semibold tabular-nums',
        score === null ? 'bg-muted text-muted-foreground' : SCORE_CLASS[Math.floor(score)],
        lowest && 'ring-[1.5px] ring-foreground',
      )}
    >
      {score ?? '–'}
    </span>
  )
}
