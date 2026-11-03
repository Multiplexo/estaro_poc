import { useTranslation } from '@/i18n'
import { LoaderCircleIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InquiryErrorIndicator } from './inquiry-error-indicator'
import type { ProcessingJob } from '@/lib/api'
import { extractionStepLabel, jobStatusLabel, matchingStopLabel, pipelineStepLabel } from '@/lib/jobs'
import type { MatchingResult } from '@/lib/inquiry-models'

export function JobStatus({ job, matchingStatus }: { job: ProcessingJob | null; matchingStatus?: MatchingResult['status'] }) {
  const { t } = useTranslation()
  const label = jobStatusLabel(job)
  const matchingStop = matchingStopLabel(matchingStatus)

  if (!job) return <div className="flex items-center gap-2 text-muted-foreground"><span>{label}</span>{matchingStop ? <InquiryErrorIndicator message={matchingStop} /> : null}</div>

  return (
    <div role="status" aria-atomic="true" className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>
          {job.status === 'running' || job.status === 'cancelling' ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : null}
          {label}
        </Badge>
        {job.last_error || matchingStop ? <InquiryErrorIndicator message={[job.last_error ? t('jobs.lastError', { error: job.last_error }) : null, matchingStop].filter(Boolean).join('\n\n')} /> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {job.status === 'failed' && (job.current_step || job.step) ? `${job.current_step ? extractionStepLabel(job.current_step) : pipelineStepLabel(job.step!)} · ` : ''}
        {t('jobs.steps', { count: job.completed_steps, total: job.total_steps ?? 3 })}
        {job.attempts > 0 ? t('jobs.attempt', { count: job.attempts }) : ''}
      </p>
    </div>
  )
}
