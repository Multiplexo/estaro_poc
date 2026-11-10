import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import * as testing from '@testing-library/react/pure'
import type { Window } from 'happy-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiProvider } from '../src/contexts/api-provider'
import { createApi } from '../src/lib/api'
import type { ExtractionResult, VerifiedField } from '../src/lib/inquiry-models'
import { analysisFields } from '../src/lib/inquiry-analysis'
import { useMasterDataSearch } from '../src/hooks/use-master-data-search'
import { useInlineMatching } from '../src/hooks/use-inline-matching'
import { createInquiryEvaluation } from '../src/lib/inquiry-evaluation'
import { changeReviewField, reviewDraft } from '../src/lib/inquiry-review'
import { inquiryDetail } from '../src/lib/inquiry-detail'
import { InlineMasterDataSearch } from '../src/components/inquiries/inline-master-data-search'

const clients: QueryClient[] = []
let server: ReturnType<typeof Bun.serve>
let searches: URL[]
let detailRequests: string[]
let searchFailure: boolean

const field: VerifiedField = { value: null, status: 'missing', sources: [] }
const extraction: ExtractionResult = {
  customer: { ...field, value: 'Muster GmbH' }, reference_number: field, requirements: field,
  items: [{ article: { ...field, value: 'Rohr' }, material: field, dimensions: field, quantity: field, unit: field, requirements: field, alternatives: field, certificates: field }],
  customer_match: { status: 'matched', note: '', candidates: [{ id: 'customer', customer_number: 'K1', name: 'Muster GmbH', reason: 'Name' }] },
  metadata: { model: 'test', processing_version: 'test' },
}

beforeAll(() => {
  server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/customer') || url.pathname.endsWith('/42')) {
      detailRequests.push(url.pathname)
      return Response.json(url.pathname.endsWith('/customer')
        ? { id: 'customer', customer_number: 'K1', name: 'Muster GmbH' }
        : { id: 42, article_number: 'A1', description_1: 'Rohr' })
    }
    searches.push(url)
    if (searchFailure) return Response.json({ detail: 'Suche fehlgeschlagen' }, { status: 503 })
    return Response.json(Array.from({ length: 25 }, (_, id) => ({
      id, article_number: `A${id}`, description_1: id === 20 ? 'Rohr 1.4841' : `Artikel ${id}`,
      is_active: true, stock_quantity: '0', weight_kg: '0',
    })))
  } })
})

afterEach(async () => {
  await testing.act(async () => {
    testing.cleanup()
    clients.splice(0).forEach((client) => client.clear())
  })
})

afterAll(() => server.stop(true))

function setup() {
  searchFailure = false
  searches = []
  detailRequests = []
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider>
  }
}

test('search browses the full master, debounces input and resets pagination', async () => {
  const view = testing.renderHook(() => useMasterDataSearch('articles', ''), { wrapper: setup() })
  await testing.waitFor(() => expect(view.result.current.results.isSuccess).toBe(true))
  expect(searches[0].pathname).toBe('/api/articles')
  expect(searches[0].searchParams.get('limit')).toBe('1000')
  expect(view.result.current.results.data?.total).toBe(25)
  testing.act(() => view.result.current.setOffset(10))
  await testing.waitFor(() => expect(view.result.current.results.data?.items[0].id).toBe(10))
  testing.act(() => view.result.current.setSearch(' Rohr 1.4841 '))
  expect(view.result.current.waiting).toBe(true)
  expect(view.result.current.offset).toBe(0)
  await testing.waitFor(() => expect(view.result.current.waiting).toBe(false))
  expect(view.result.current.results.data?.items.map((item) => item.id)).toEqual([20])
  expect(view.result.current.results.data?.total).toBe(1)
  expect(searches).toHaveLength(1)
  searchFailure = true
  await testing.act(async () => { await view.result.current.results.refetch() })
  await testing.waitFor(() => expect(view.result.current.results.isError).toBe(true))
  expect(view.result.current.results.error?.message).toBe('Suche fehlgeschlagen')
})

test.each([390, 1280])('opening master-data search at %ipx focuses the input only on desktop', async (width) => {
  const dom = window as unknown as Window
  dom.happyDOM.setWindowSize({ width, height: 900 })
  try {
    const wrapper = setup()
    const view = testing.render(<InlineMasterDataSearch kind="articles" initialSearch="" suggestions={[]} onSelect={() => {}} />, { wrapper })
    const input = view.getByRole('searchbox', { name: 'Artikel suchen' })
    expect(document.activeElement === input).toBe(width >= 768)
    await testing.waitFor(() => expect(searches).toHaveLength(1))
  } finally {
    dom.happyDOM.setWindowSize({ width: 1024, height: 768 })
  }
})


function suggestions(result = extraction, correctedId?: string) {
  const fields = analysisFields(result)
  const review = reviewDraft({ fields: Object.fromEntries(fields.map((entry) => [entry.id, {
    value: entry.id === correctedId ? 'Geändert' : entry.field.value ?? '', confirmed: false,
  }])) })
  return createInquiryEvaluation(result, fields).suggestions(review, 'customer')
}

test('inline proposals require an explicit acceptance after details load', async () => {
  const selections: (string | undefined)[] = []
  const view = testing.renderHook(() => useInlineMatching('customers', undefined, suggestions(), (id) => selections.push(id)), { wrapper: setup() })
  testing.act(() => view.result.current.accept())
  expect(selections).toHaveLength(0)
  await testing.waitFor(() => expect(view.result.current.details.isSuccess).toBe(true))
  expect(selections).toHaveLength(0)
  expect(view.result.current.selected).toBe(false)
  testing.act(() => view.result.current.accept())
  expect(selections).toEqual(['customer'])
})

test('changing or clearing an inline assignment does not require checked fields', () => {
  const selections: (string | undefined)[] = []
  const view = testing.renderHook(() => useInlineMatching('articles', undefined, [], (id) => selections.push(id)), { wrapper: setup() })
  testing.act(() => view.result.current.setSearching(true))
  testing.act(() => view.result.current.select('variant'))
  expect(view.result.current.searching).toBe(false)
  expect(selections).toEqual(['variant'])
  testing.act(() => view.result.current.select(undefined))
  expect(selections).toEqual(['variant', undefined])
})

test('corrected names suppress stale customer suggestions', () => {
  expect(suggestions()).toHaveLength(1)
  expect(suggestions(extraction, 'customer')).toEqual([])
})

test('article suggestions come from matching and disappear after dependent corrections', () => {
  const result: ExtractionResult = { ...extraction, matching: { targets: [{ field_id: 'item-0-article', candidates: [
    { id: 'variant', number: 'A1', label: 'Rohr', status: 'matching' },
  ] }] } }
  const fields = analysisFields(result)
  const evaluation = createInquiryEvaluation(result, fields)
  const values = (correctedId?: string) => reviewDraft({ fields: Object.fromEntries(fields.map((entry) => [entry.id, { value: entry.id === correctedId ? 'Geändert' : entry.field.value ?? '', confirmed: false }])) })
  expect(evaluation.suggestions(values(), 'item-0-article')).toHaveLength(1)
  expect(evaluation.suggestions(values('item-0-material'), 'item-0-article')).toEqual([])
  expect(evaluation.suggestions(values('customer'), 'item-0-article')).toEqual([])
})

test('reopening an inline match reuses fresh candidate details', async () => {
  const wrapper = setup()
  const first = testing.renderHook(() => useInlineMatching('articles', '42', [], () => {}), { wrapper })
  await testing.waitFor(() => expect(first.result.current.details.isSuccess).toBe(true))
  first.unmount()
  const second = testing.renderHook(() => useInlineMatching('articles', '42', [], () => {}), { wrapper })
  await testing.waitFor(() => expect(second.result.current.details.isSuccess).toBe(true))
  expect(second.result.current.selected).toBe(true)
  expect(second.result.current.details.data?.id).toBe(42)
  expect(detailRequests).toEqual(['/api/articles/42'])
  expect(detailRequests).toHaveLength(1)
})

test.each(['customer_number', 'customer_location'] as const)('correcting %s clears assignments and hides stale suggestions in both views', (kind) => {
  const result: ExtractionResult = { ...extraction, [kind]: { ...field, value: 'Original', status: 'present' } }
  const fields = analysisFields(result)
  const entry = fields.find((entry) => entry.id === kind)!
  expect(suggestions(result)).toHaveLength(1)
  expect(suggestions(result, kind)).toEqual([])
  const review = changeReviewField(reviewDraft({ customer_id: 'customer', position_confirmations: { 'item-0-article': { origin: 'manual' } } }), entry, 'Geändert')
  expect(review.customer_id).toBeNull()
  expect(review.position_confirmations).toEqual({})
  const detail = inquiryDetail({ id: 'inquiry', documents: [], file_types: [], created_at: '', processing_job: null }, { extraction: result, review })
  expect(detail.customerId).toBeUndefined()
})
