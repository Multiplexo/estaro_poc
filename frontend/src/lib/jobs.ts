import i18n from '../i18n'
import type { PipelineStep, ProcessingJob } from './api'
import type { MatchingResult } from './inquiry-models'

export function matchingStopLabel(status?: MatchingResult['status']) {
  return status && status !== 'completed' ? i18n.t('jobs.matchingStopped', { reason: i18n.t(`jobs.${status}`) }) : undefined
}

export function pipelineStepLabel(step: PipelineStep): string {
  return i18n.t(`jobs.${step}`)
}

export function isJobActive(job: ProcessingJob | null) {
  return job?.status === 'queued' || job?.status === 'running' || job?.status === 'cancelling'
}

export function jobStatusLabel(job: ProcessingJob | null) {
  if (!job) return i18n.t('jobs.notScheduled')

  switch (job.status) {
    case 'queued':
      return job.attempts > 0 ? i18n.t('jobs.retryScheduled') : i18n.t('jobs.queued')
    case 'running':
      return job.current_step ? `${extractionStepLabel(job.current_step)} …` : job.step ? i18n.t('jobs.runningStep', { step: pipelineStepLabel(job.step) }) : i18n.t('jobs.starting')
    case 'completed':
      return i18n.t('jobs.completed')
    case 'cancelling':
      return i18n.t('jobs.cancelling')
    case 'cancelled':
      return i18n.t('jobs.cancelled')
    case 'failed':
      return i18n.t('jobs.failed')
  }
}

export function extractionStepLabel(step: string): string {
  const labels: Record<string, string> = {
    load: 'PDF laden', document_classification: 'Dokument aufbereiten',
    extract: 'Extraktion', validate: 'Validierung',
    recheck_missing_fields: 'Fehlende Angaben prüfen',
    recheck_fields: 'Fehlende und unsichere Angaben prüfen',
  }
  return labels[step] ?? step
}
