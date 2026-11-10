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
      return job.current_step ? i18n.t('jobs.runningStep', { step: extractionStepLabel(job.current_step) }) : job.step ? i18n.t('jobs.runningStep', { step: pipelineStepLabel(job.step) }) : i18n.t('jobs.starting')
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
    load: i18n.t('jobs.stepsLabels.load'), document_classification: i18n.t('jobs.stepsLabels.document_classification'),
    extract: i18n.t('jobs.extraction'), validate: i18n.t('jobs.stepsLabels.validate'),
    recheck_missing_fields: i18n.t('jobs.stepsLabels.recheck_missing_fields'),
    recheck_fields: i18n.t('jobs.stepsLabels.recheck_fields'),
  }
  return labels[step] ?? step
}
