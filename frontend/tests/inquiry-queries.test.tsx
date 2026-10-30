import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { Window } from 'happy-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiProvider } from '../src/contexts/api-provider'
import { useInquiryAnalysis } from '../src/hooks/use-inquiry-analysis'
import { createApi } from '../src/lib/api'
import type { JobStatus } from '../src/lib/generated/Api'

let testing: typeof import('@testing-library/react/pure')
let server: ReturnType<typeof Bun.serve>
const originals = new Map<string, PropertyDescriptor | undefined>()
const clients: QueryClient[] = []
let status: JobStatus
let revision: number
let inquiryRequests: number
let analysisRequests: number
let inquiryGate: Promise<void> | undefined
let analysisGate: Promise<void> | undefined

beforeAll(async () => {
  const dom = new Window({ url: 'http://localhost' })
  for (const [key, value] of Object.entries({
    window: dom, document: dom.document, navigator: dom.navigator,
    HTMLElement: dom.HTMLElement, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  testing = await import('@testing-library/react/pure')
  server = Bun.serve({ port: 0, async fetch(request) {
    if (new URL(request.url).pathname.endsWith('/analysis')) {
      analysisRequests++
      const snapshot = revision
      const gate = analysisGate
      analysisGate = undefined
      await gate
      return Response.json({ extraction: null, sources: [], review: { revision: snapshot } })
    }
    inquiryRequests++
    await inquiryGate
    return Response.json({ id: 'inquiry', documents: [], file_types: [], processing_job: { status } })
  } })
})

afterEach(() => {
  testing.cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

afterAll(() => {
  server.stop(true)
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

function setup(initialStatus: JobStatus, holds: { inquiry?: Promise<void>; analysis?: Promise<void> } = {}) {
  status = initialStatus
  revision = inquiryRequests = analysisRequests = 0
  inquiryGate = holds.inquiry
  analysisGate = holds.analysis
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider>
  }
  const hook = testing.renderHook(() => ({ first: useInquiryAnalysis('inquiry'), second: useInquiryAnalysis('inquiry') }), { wrapper: Wrapper })
  return { ...hook, client }
}

test('cold loads fetch analysis once in parallel and share it between callers', async () => {
  const hold = gate()
  const { result, client } = setup('completed', { inquiry: hold.promise })
  try {
    await testing.waitFor(() => expect(result.current.first.analysis.isSuccess).toBe(true))
    expect(result.current.first.inquiry.isPending).toBe(true)
    await testing.act(async () => { hold.release() })
    await testing.waitFor(() => expect(result.current.first.inquiry.isSuccess).toBe(true))
    expect(result.current.second.analysis.data).toBe(result.current.first.analysis.data)
    expect(inquiryRequests).toBe(1)
    expect(analysisRequests).toBe(1)
    expect(client.getQueryCache().findAll({ queryKey: ['inquiry-analysis', 'inquiry'] })).toHaveLength(1)
  } finally { hold.release() }
})

test.each(['completed', 'failed', 'cancelled'] as const)('a %s job refreshes analysis while preserving displayed data', async (terminalStatus) => {
  const { result, client } = setup('running')
  await testing.waitFor(() => {
    expect(result.current.first.inquiry.isSuccess).toBe(true)
    expect(result.current.first.analysis.data?.review?.revision).toBe(0)
  })
  const hold = gate()
  analysisGate = hold.promise
  status = terminalStatus
  revision = 1
  try {
    await testing.act(() => client.invalidateQueries({ queryKey: ['inquiry', 'inquiry'] }))
    await testing.waitFor(() => expect(analysisRequests).toBe(2))
    expect(result.current.first.analysis.isSuccess).toBe(true)
    expect(result.current.first.analysis.data?.review?.revision).toBe(0)
    await testing.act(async () => { hold.release() })
    await testing.waitFor(() => expect(result.current.first.analysis.data?.review?.revision).toBe(1))
  } finally { hold.release() }
})

test('completion replaces an in-flight analysis request that captured an older result', async () => {
  const hold = gate()
  const { result, client } = setup('running', { analysis: hold.promise })
  try {
    await testing.waitFor(() => {
      expect(result.current.first.inquiry.isSuccess).toBe(true)
      expect(analysisRequests).toBe(1)
    })
    status = 'completed'
    revision = 1
    await testing.act(() => client.invalidateQueries({ queryKey: ['inquiry', 'inquiry'] }))
    await testing.waitFor(() => expect(result.current.first.analysis.data?.review?.revision).toBe(1))
    expect(analysisRequests).toBe(2)
    await testing.act(async () => { hold.release() })
    expect(client.getQueryData<{ review: { revision: number } }>(['inquiry-analysis', 'inquiry'])?.review.revision).toBe(1)
  } finally { hold.release() }
})
