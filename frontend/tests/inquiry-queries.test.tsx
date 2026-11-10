import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import * as testing from '@testing-library/react/pure'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiProvider } from '../src/contexts/api-provider'
import { useInquiryAnalysis } from '../src/hooks/use-inquiry-analysis'
import { createApi } from '../src/lib/api'
import type { ExtractionJobStatus } from '../src/lib/generated/Api'

let server: ReturnType<typeof Bun.serve>
const clients: QueryClient[] = []
let status: ExtractionJobStatus['status']
let matchingStatus: ExtractionJobStatus['status']
let revision: number
let inquiryRequests: number
let analysisRequests: number
let inquiryGate: Promise<void> | undefined
let analysisGate: Promise<void> | undefined

function job(): ExtractionJobStatus {
  return {
    id: 'job', inquiry_id: 'inquiry', document_id: null, source_key: null, status,
    current_step: null, completed_steps: status === 'succeeded' ? 4 : 0, total_steps: 4,
    error: status === 'failed' ? 'Extraction failed' : null,
    created_at: '2026-10-28T10:00:00Z', started_at: null, finished_at: null,
  }
}

beforeAll(() => {
  server = Bun.serve({ port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/api/inquiries/inquiry/extraction-job') return Response.json(job())
    if (path === '/api/extractions/job/matching') return Response.json({ id: 'matching', status: matchingStatus, error: null })
    if (path === '/api/inquiries/inquiry/extractions') {
      analysisRequests++
      const snapshot = revision
      const gate = analysisGate
      analysisGate = undefined
      await gate
      return Response.json([{ job_id: 'job', result: {}, review: { revision: snapshot, fields: {} } }])
    }
    if (path === '/api/inquiries/inquiry') {
      inquiryRequests++
      await inquiryGate
      return Response.json({ id: 'inquiry', created_at: '2026-10-28T10:00:00Z', documents: [] })
    }
    return new Response(null, { status: 404 })
  } })
})

afterEach(() => {
  testing.cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

afterAll(() => server.stop(true))

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

function setup(holds: { inquiry?: Promise<void>; analysis?: Promise<void> } = {}) {
  status = 'running'
  matchingStatus = 'succeeded'
  revision = inquiryRequests = analysisRequests = 0
  inquiryGate = holds.inquiry
  analysisGate = holds.analysis
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['inquiry-job', 'inquiry'], job())
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider>
  }
  const hook = testing.renderHook(() => ({ first: useInquiryAnalysis('inquiry'), second: useInquiryAnalysis('inquiry') }), { wrapper: Wrapper })
  return { ...hook, client }
}

test('cold loads wait for inquiry documents and share analysis between callers', async () => {
  const hold = gate()
  const { result, client } = setup({ inquiry: hold.promise })
  try {
    await testing.waitFor(() => expect(inquiryRequests).toBe(1))
    expect(result.current.first.inquiry.isPending).toBe(true)
    expect(result.current.first.analysis.fetchStatus).toBe('idle')
    expect(analysisRequests).toBe(0)
    await testing.act(async () => { hold.release() })
    await testing.waitFor(() => expect(result.current.first.analysis.isSuccess).toBe(true))
    expect(result.current.second.analysis.data).toBe(result.current.first.analysis.data)
    expect(inquiryRequests).toBe(1)
    expect(analysisRequests).toBe(1)
    expect(client.getQueryCache().findAll({ queryKey: ['inquiry-analysis', 'inquiry'] })).toHaveLength(1)
    expect(result.current.first.reviewReady).toBe(false)
  } finally { hold.release() }
})

test.each([
  ['succeeded', 'succeeded'],
  ['succeeded', 'failed'],
  ['failed', 'succeeded'],
] as const)('extraction %s and matching %s refresh analysis and gate review readiness', async (extraction, matching) => {
  const { result, client } = setup()
  await testing.waitFor(() => expect(result.current.first.analysis.data?.review?.revision).toBe(0))
  status = extraction
  matchingStatus = matching
  revision = 1
  await testing.act(async () => { await client.invalidateQueries({ queryKey: ['inquiry-job', 'inquiry'] }) })
  await testing.waitFor(() => {
    expect(result.current.first.analysis.data?.review?.revision).toBe(1)
    expect(result.current.first.inquiry.data?.processing_job?.status).toBe(extraction === 'failed' || matching === 'failed' ? 'failed' : 'completed')
    expect(result.current.first.reviewReady).toBe(extraction === 'succeeded')
  })
  expect(analysisRequests).toBeGreaterThan(1)
  expect(result.current.second.analysis.data).toBe(result.current.first.analysis.data)
})

test('completion replaces an in-flight analysis request that captured an older result', async () => {
  const hold = gate()
  const { result, client } = setup({ analysis: hold.promise })
  try {
    await testing.waitFor(() => expect(analysisRequests).toBe(1))
    status = 'succeeded'
    revision = 1
    await testing.act(async () => { await client.invalidateQueries({ queryKey: ['inquiry-job', 'inquiry'] }) })
    await testing.waitFor(() => {
      expect(result.current.first.reviewReady).toBe(true)
      expect(result.current.first.analysis.data?.review?.revision).toBe(1)
    })
    await testing.act(async () => { hold.release() })
    expect(result.current.first.analysis.data?.review?.revision).toBe(1)
    expect(result.current.second.analysis.data).toBe(result.current.first.analysis.data)
  } finally { hold.release() }
})
