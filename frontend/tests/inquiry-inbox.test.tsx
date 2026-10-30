import { afterAll, afterEach, beforeAll, expect, spyOn, test } from 'bun:test'
import type { ReactNode } from 'react'
import { Window } from 'happy-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiProvider } from '../src/contexts/api-provider'
import { useInquiryInbox } from '../src/hooks/use-inquiry-inbox'
import { useInquiryQueue } from '../src/hooks/use-inquiry-queue'
import { createApi } from '../src/lib/api'
import { deadlineHint, inquiryOverview } from '../src/lib/inquiry-overview'
import type { InquiryOverview } from '../src/lib/generated/Api'
import i18n from '../src/i18n'

let testing: typeof import('@testing-library/react/pure')
const originals = new Map<string, PropertyDescriptor | undefined>()
const clients: QueryClient[] = []
let server: ReturnType<typeof Bun.serve>
let waiting: boolean
let total: number
const requests: URL[] = []
const row: InquiryOverview = {
  id: 'inquiry-1', created_at: '2026-10-28T10:00:00Z', documents: [], file_types: [],
  processing_job: null, customer_name: 'Muster GmbH', email: 'kunde@example.org',
  email_received_at: null, subject: 'Anfrage Edelstahl', reference_number: 'A-49',
  review_status: 'new', extraction: null,
}

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
  server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    requests.push(url)
    if (url.searchParams.get('view') === 'queue') {
      return Response.json({ total: waiting ? 1 : 0, items: waiting ? [{ ...row, processing_job: null }] : [] })
    }
    return Response.json({ total: waiting ? 0 : total, items: waiting ? [] : [row] })
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

function setup(queued = false) {
  waiting = queued
  total = 26
  requests.length = 0
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider>
  }
  return { ...testing.renderHook(() => ({ inbox: useInquiryInbox(), queue: useInquiryQueue() }), { wrapper: Wrapper }), client }
}

test('queue completion refreshes the inbox without changing the selected view', async () => {
  const view = setup(true)
  await testing.waitFor(() => {
    expect(view.result.current.queue.data?.total).toBe(1)
    expect(view.result.current.inbox.query.data?.total).toBe(0)
  })
  testing.act(() => view.result.current.inbox.setView('table'))
  waiting = false
  await testing.act(async () => { await view.client.invalidateQueries({ queryKey: ['inquiries', 'queue'] }) })
  await testing.waitFor(() => expect(view.result.current.inbox.query.data?.items[0].id).toBe(row.id))
  expect(view.result.current.inbox.view).toBe('table')
  expect(view.result.current.queue.data?.total).toBe(0)
})

test('search, status and sort reset pagination and reach the overview API', async () => {
  const view = setup()
  await testing.waitFor(() => expect(view.result.current.inbox.query.data?.total).toBe(26))
  testing.act(() => view.result.current.inbox.setPage(1))
  await testing.waitFor(() => expect(requests.some((url) => url.searchParams.get('offset') === '25')).toBe(true))
  testing.act(() => {
    view.result.current.inbox.setSearch('Muster')
    view.result.current.inbox.setStatus('reviewed')
    view.result.current.inbox.setSort('customer')
  })
  await testing.waitFor(() => {
    const last = requests.filter((url) => url.pathname.endsWith('/overview')).at(-1)!
    expect(last.searchParams.get('search')).toBe('Muster')
    expect(last.searchParams.get('offset')).toBe('0')
    expect(last.searchParams.get('review_status')).toBe('reviewed')
    expect(last.searchParams.get('sort')).toBe('customer')
  })
})

test('local view changes and debounced typing reuse the existing overview calculation', async () => {
  const view = setup()
  await testing.waitFor(() => expect(view.result.current.inbox.query.isSuccess).toBe(true))
  const translate = spyOn(i18n, 't')
  try {
    testing.act(() => view.result.current.inbox.setView('table'))
    testing.act(() => view.result.current.inbox.setSearch('Muster'))
    expect(view.result.current.inbox.waiting).toBe(true)
    expect(translate.mock.calls.filter(([key]) => key === 'traffic.noPositions')).toHaveLength(0)
  } finally { translate.mockRestore() }
})

test('missing metadata stays unknown and empty extraction never receives a green score', () => {
  const result = inquiryOverview(row)
  expect(result.email_received_at).toBeNull()
  expect(result.deliveryDate).toBeNull()
  expect(result.trafficLight.color).toBe('yellow')
  expect(result.description).toBe('Anfrage Edelstahl')
})

test('saved delivery corrections and manual confirmations are reflected in the overview', () => {
  const field = { value: 'Rohr', status: 'present' as const, sources: [] }
  const result = inquiryOverview({
    ...row,
    extraction: {
      customer: field, reference_number: field, requirements: field,
      delivery_date: { ...field, value: 'KW 48' },
      items: [{ article: field, material: field, dimensions: field, quantity: field, unit: field, requirements: field, alternatives: field, certificates: field }],
      customer_match: { status: 'unmatched', note: '' },
    },
    review: {
      fields: { delivery_date: { value: '01.12.2026', confirmed: true } },
      position_confirmations: { 'item-0-article': { origin: 'manual', confirmed_at: '2026-10-28T10:00:00Z' } },
    },
  })
  expect(result.deliveryDate).toBe('01.12.2026')
  expect(result.trafficLight).toMatchObject({ color: 'green', origin: 'manual' })
})

test('deadline hints mark explicit dates without inventing dates for calendar weeks or relative terms', () => {
  const now = new Date(2026, 9, 28, 12)
  expect(deadlineHint('27.10.2026', now)).toEqual({ overdue: true, label: '1 Tag überfällig' })
  expect(deadlineHint('2026-10-28', now)).toEqual({ overdue: false, label: 'Heute' })
  expect(deadlineHint('30.10.2026', now)).toEqual({ overdue: false, label: '2 Tage' })
  for (const value of ['KW 48', 'schnellstmöglich', '31.02.2026', '01.12.2026']) expect(deadlineHint(value, now)).toBeNull()
})
