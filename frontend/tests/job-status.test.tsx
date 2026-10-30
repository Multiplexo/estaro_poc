import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { JobStatus } from '../src/components/inquiries/job-status'
import type { ProcessingJob } from '../src/lib/api'

function job(values: Partial<ProcessingJob> = {}): ProcessingJob {
  return {
    id: 'job-1',
    status: 'queued',
    step: null,
    attempts: 0,
    completed_steps: 0,
    created_at: '2026-10-27T12:00:00Z',
    available_at: '2026-10-27T12:00:00Z',
    started_at: null,
    finished_at: null,
    last_error: null,
    ...values,
  }
}

test('shows the active pipeline step and saved progress', () => {
  const html = renderToStaticMarkup(
    <JobStatus job={job({ status: 'running', step: 'extraction', attempts: 1, completed_steps: 1 })} />,
  )

  expect(html).toContain('Extraktion …')
  expect(html).toContain('1/3 Schritte')
  expect(html).toContain('Versuch 1')
  expect(html).toContain('role="status"')
})

test('distinguishes a queued retry from the first queued attempt', () => {
  const queued = renderToStaticMarkup(<JobStatus job={job()} />)
  const retry = renderToStaticMarkup(
    <JobStatus job={job({ attempts: 1, last_error: 'Timeout after 300s' })} />,
  )

  expect(queued).toContain('In Warteschlange')
  expect(retry).toContain('Wiederholung geplant')
  expect(retry).toContain('Letzter Fehler: Timeout after 300s')
})

test('shows the failed step and its technical error', () => {
  const html = renderToStaticMarkup(
    <JobStatus job={job({ status: 'failed', step: 'matching', attempts: 3, completed_steps: 2, last_error: 'Matching unavailable' })} />,
  )

  expect(html).toContain('Fehlgeschlagen')
  expect(html).toContain('Matching · ')
  expect(html).toContain('2/3 Schritte')
  expect(html).toContain('Matching unavailable')
})

test('shows completion and does not invent a job for older inquiries', () => {
  const completed = renderToStaticMarkup(
    <JobStatus job={job({ status: 'completed', completed_steps: 3 })} />,
  )
  const legacy = renderToStaticMarkup(<JobStatus job={null} />)

  expect(completed).toContain('Abgeschlossen')
  expect(completed).toContain('3/3 Schritte')
  expect(legacy).toContain('Nicht eingeplant')
  expect(legacy).not.toContain('/3 Schritte')
})

test('shows matching execution errors only in the separate processing status', () => {
  const html = renderToStaticMarkup(<JobStatus job={job({ status: 'completed', completed_steps: 3 })} matchingStatus="model_error" />)
  expect(html).toContain('Matching vorzeitig beendet: Modellfehler')
  expect(html).toContain('3/3 Schritte')
  expect(html).not.toContain('fachlicher Konflikt')
})
