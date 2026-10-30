import { useTranslation } from '@/i18n'
import { LoaderCircleIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProcessingJob } from '@/lib/api'
import { extractionStepLabel, jobStatusLabel, matchingStopLabel, pipelineStepLabel } from '@/lib/jobs'
import type { MatchingResult } from '@/lib/inquiry-models'

export function JobStatus({ job, matchingStatus }: { job: ProcessingJob | null; matchingStatus?: MatchingResult['status'] }) {
  const { t } = useTranslation()
  const label = jobStatusLabel(job)
  const matchingStop = matchingStopLabel(matchingStatus)

  if (!job) return <div className="text-muted-foreground"><span>{label}</span>{matchingStop ? <p className="text-xs text-destructive">{matchingStop}</p> : null}</div>

  return (
    <div role="status" aria-atomic="true" className="space-y-1.5">
      <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>
        {job.status === 'running' || job.status === 'cancelling' ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : null}
        {label}
      </Badge>
      <p className="text-xs text-muted-foreground">
        {job.status === 'failed' && (job.current_step || job.step) ? `${job.current_step ? extractionStepLabel(job.current_step) : pipelineStepLabel(job.step!)} · ` : ''}
        {t('jobs.steps', { count: job.completed_steps, total: job.total_steps ?? 3 })}
        {job.attempts > 0 ? t('jobs.attempt', { count: job.attempts }) : ''}
      </p>
      {job.last_error ? (
        <p className="max-w-xs text-xs whitespace-normal break-words text-destructive">
          {t('jobs.lastError', { error: job.last_error })}
        </p>
      ) : null}
      {matchingStop ? <p className="max-w-xs text-xs text-destructive">{matchingStop}</p> : null}
    </div>
  )
}
