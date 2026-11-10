import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import * as testing from '@testing-library/react/pure'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiProvider } from '../src/contexts/api-provider'
import { useDeleteInquiry } from '../src/hooks/use-delete-inquiry'
import { useCancelInquiry } from '../src/hooks/use-cancel-inquiry'
import { InquiryJobActions } from '../src/components/inquiries/inquiry-job-actions'
import { useInquiryInbox } from '../src/hooks/use-inquiry-inbox'
import { useRecentInquiries } from '../src/hooks/use-recent-inquiries'
import { createApi, type Inquiry, type JobStatus } from '../src/lib/api'

const clients: QueryClient[] = []
let server: ReturnType<typeof Bun.serve>
let inquiries: Inquiry[]
let deletions: string[]
let cancellations: string[]
let failure: number | null
let release: (() => void) | undefined
let hold: Promise<void> | undefined

beforeAll(() => {
  server = Bun.serve({ port: 0, async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'POST') {
      cancellations.push(url.pathname)
      return new Response(null, { status: 404 })
    }
    if (request.method === 'DELETE') {
      expect(url.pathname).toStartWith('/api/inquiries/')
      const id = url.pathname.split('/').at(-1)!
      deletions.push(id)
      await hold
      if (failure) return Response.json({ detail: 'Löschen derzeit nicht möglich.' }, { status: failure })
      inquiries = inquiries.filter((inquiry) => inquiry.id !== id)
      return new Response(null, { status: 204 })
    }
    if (url.pathname !== '/api/inquiries/overview') return new Response(null, { status: 404 })
    const offset = Number(url.searchParams.get('offset'))
    const limit = Number(url.searchParams.get('limit'))
    return Response.json({ items: inquiries.slice(offset, offset + limit).map((inquiry) => ({
      ...inquiry, latest_extraction: { job_id: 'job', result: {}, review: { revision: 0, fields: {} } },
    })), total: inquiries.length })
  } })
})

afterEach(() => {
  release?.()
  testing.cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

afterAll(() => server.stop(true))

function setup(count = 1, status?: JobStatus) {
  inquiries = Array.from({ length: count }, (_, index) => ({
    id: `inquiry-${index}`, created_at: '2026-10-27T10:00:00Z',
    documents: [], file_types: [], processing_job: status ? {
      id: `job-${index}`, status, step: null, attempts: 0, completed_steps: 0,
      created_at: '2026-10-27T10:00:00Z', available_at: '2026-10-27T10:00:00Z',
      started_at: null, finished_at: null, last_error: null,
    } : null,
  }))
  deletions = []
  cancellations = []
  failure = null
  hold = undefined
  release = undefined
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider>
  }
  return { ...testing.renderHook(() => {
    const { query, page, setPage } = useInquiryInbox()
    return { list: { ...query, page, setPage }, recent: useRecentInquiries(), deletion: useDeleteInquiry(), cancellation: useCancelInquiry() }
  }, { wrapper: Wrapper }), client, Wrapper }
}

test('canceling the confirmation leaves the inquiry untouched', async () => {
  const view = setup()
  await testing.waitFor(() => expect(view.result.current.list.data?.total).toBe(1))
  testing.act(() => view.result.current.deletion.selectInquiry(inquiries[0]))
  expect(view.result.current.deletion.inquiry?.id).toBe('inquiry-0')
  expect(deletions).toEqual([])
  testing.act(() => view.result.current.deletion.selectInquiry(null))
  expect(view.result.current.deletion.inquiry).toBeNull()
  expect(inquiries).toHaveLength(1)
  expect(deletions).toEqual([])
})

test('recent inquiries stay on the first ten entries and refill after deletion', async () => {
  const view = setup(26)
  await testing.waitFor(() => expect(view.result.current.recent.data?.items).toHaveLength(10))
  expect(view.result.current.recent.data?.items[0]?.id).toBe('inquiry-0')
  testing.act(() => view.result.current.list.setPage(1))
  await testing.waitFor(() => expect(view.result.current.list.data?.items[0]?.id).toBe('inquiry-25'))
  expect(view.result.current.recent.data?.items[0]?.id).toBe('inquiry-0')

  testing.act(() => view.result.current.deletion.selectInquiry(inquiries[0]))
  testing.act(() => view.result.current.deletion.confirm())
  await testing.waitFor(() => {
    expect(view.result.current.recent.data?.items[0]?.id).toBe('inquiry-1')
    expect(view.result.current.recent.data?.items.at(-1)?.id).toBe('inquiry-10')
  })
  expect(view.result.current.recent.data?.items).toHaveLength(10)
})

test('confirmed deletion sends one request, clears cached details and returns from an empty last page', async () => {
  const view = setup(26)
  view.client.setQueryData(['inquiry', 'inquiry-25'], inquiries[25])
  view.client.setQueryData(['inquiry-analysis', 'inquiry-25', 'completed'], { sources: [] })
  await testing.waitFor(() => expect(view.result.current.list.data?.total).toBe(26))
  testing.act(() => view.result.current.list.setPage(1))
  await testing.waitFor(() => expect(view.result.current.list.data?.items[0]?.id).toBe('inquiry-25'))
  testing.act(() => view.result.current.deletion.selectInquiry(inquiries[25]))
  hold = new Promise<void>((resolve) => { release = resolve })
  testing.act(() => view.result.current.deletion.confirm())
  await testing.waitFor(() => expect(deletions).toEqual(['inquiry-25']))
  expect(view.result.current.deletion.isPending).toBe(true)
  testing.act(() => {
    view.result.current.deletion.confirm()
    view.result.current.deletion.selectInquiry(null)
  })
  expect(view.result.current.deletion.inquiry?.id).toBe('inquiry-25')
  release!()
  await testing.waitFor(() => {
    expect(view.result.current.deletion.inquiry).toBeNull()
    expect(view.result.current.list.page).toBe(0)
    expect(view.result.current.list.data?.items[0]?.id).toBe('inquiry-0')
  })
  expect(deletions).toEqual(['inquiry-25'])
  expect(view.client.getQueryData(['inquiry', 'inquiry-25'])).toBeUndefined()
  expect(view.client.getQueryData(['inquiry-analysis', 'inquiry-25', 'completed'])).toBeUndefined()
  expect(view.result.current.list.data?.total).toBe(25)
})

test.each([409, 503])('HTTP %s keeps the dialog and inquiry available for retry', async (status) => {
  const view = setup()
  failure = status
  testing.act(() => view.result.current.deletion.selectInquiry(inquiries[0]))
  testing.act(() => view.result.current.deletion.confirm())
  await testing.waitFor(() => expect(view.result.current.deletion.error).toBe('Löschen derzeit nicht möglich.'))
  expect(view.result.current.deletion.inquiry?.id).toBe('inquiry-0')
  expect(inquiries).toHaveLength(1)
  failure = null
  testing.act(() => view.result.current.deletion.confirm())
  await testing.waitFor(() => {
    expect(view.result.current.deletion.inquiry).toBeNull()
    expect(view.result.current.list.data?.total).toBe(0)
  })
  expect(deletions).toEqual(['inquiry-0', 'inquiry-0'])
  expect(view.result.current.list.data?.items).toEqual([])
})

test.each(['queued', 'running'] as const)('cancelling %s work reports the unavailable capability without sending a request', async (status) => {
  const view = setup(1, status)
  await testing.waitFor(() => expect(view.result.current.list.data?.total).toBe(1))
  const keys = [['inquiry', 'inquiry-0'], ['inquiry-job', 'inquiry-0'], ['inquiry-analysis', 'inquiry-0']]
  keys.forEach((key) => view.client.setQueryData(key, { cached: true }))
  testing.act(() => view.result.current.cancellation.cancel('inquiry-0'))
  await testing.waitFor(() => {
    expect(view.result.current.cancellation.isPending).toBe(false)
    expect(view.result.current.cancellation.error).toBe('Diese Funktion wird von der aktuellen API nicht angeboten.')
  })
  expect(cancellations).toEqual([])
  expect(deletions).toEqual([])
  expect(inquiries[0].processing_job?.status).toBe(status)
  keys.forEach((key) => expect(view.client.getQueryState(key)?.isInvalidated).toBe(true))
})

test.each(['queued', 'running', 'cancelling', 'cancelled'] as const)('queue actions for %s work keep cancellation unavailable and allow deletion', async (status) => {
  const view = setup(1, status)
  await testing.waitFor(() => {
    expect(view.result.current.list.isSuccess).toBe(true)
    expect(view.result.current.recent.isSuccess).toBe(true)
  })
  const actions = testing.render(<InquiryJobActions inquiry={inquiries[0]} deletion={view.result.current.deletion} />, { wrapper: view.Wrapper })
  const remove = actions.getByRole('button', { name: 'Löschen' }) as HTMLButtonElement
  expect(remove.disabled).toBe(false)
  testing.fireEvent.click(remove)
  expect(view.result.current.deletion.inquiry?.id).toBe('inquiry-0')
  if (status === 'cancelled') {
    expect(actions.queryByRole('button', { name: 'Verarbeitung abbrechen' })).toBeNull()
  } else {
    const cancel = actions.getByRole('button', { name: status === 'cancelling' ? 'Wird abgebrochen …' : 'Verarbeitung abbrechen' }) as HTMLButtonElement
    expect(cancel.disabled).toBe(true)
    testing.fireEvent.click(cancel)
    expect(cancellations).toEqual([])
  }
})
