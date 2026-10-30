import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { Window } from 'happy-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from '@tanstack/react-router'
import { ApiProvider } from '../src/contexts/api-provider'
import { useInquiryReview, type ReviewEditor } from '../src/hooks/use-inquiry-review'
import { useReviewSections } from '../src/hooks/use-review-sections'
import { ExtractionPanel } from '../src/components/inquiries/extraction-panel'
import { ExtractedField } from '../src/components/inquiries/extracted-field'
import { createApi } from '../src/lib/api'
import type { AnalysisResponse, InquiryReview } from '../src/lib/generated/Api'

let testing: typeof import('@testing-library/react/pure')
const originals = new Map<string, PropertyDescriptor | undefined>()
const clients: QueryClient[] = []
let server: ReturnType<typeof Bun.serve>
let remote: InquiryReview
let submissions: InquiryReview[]

const analysis: AnalysisResponse = {
  sources: [{ id: 'email', file_type: 'msg', filename: 'Anfrage.msg' }, { id: 'attachment', file_type: 'pdf', filename: 'Anhang.pdf' }],
  review: { revision: 0, fields: {}, customer_id: null },
  extraction: {
    customer: { value: 'Muster GmbH', status: 'present', sources: [] },
    reference_number: { value: null, status: 'missing', sources: [] },
    requirements: { value: '3.1', status: 'present', sources: [{ document_id: 'attachment', filename: 'Anhang.pdf', section_id: 'page-1', page: 1, quote: '3.1', start: 0, end: 3 }] },
    items: [], customer_match: { status: 'unmatched', note: '' },
    metadata: { model: 'test', processing_version: 'test' },
  },
}

beforeAll(async () => {
  const dom = new Window({ url: 'http://localhost' })
  const globals = { window: dom, document: dom.document, navigator: dom.navigator, Element: dom.Element, HTMLElement: dom.HTMLElement, Node: dom.Node,
    requestAnimationFrame: (callback: FrameRequestCallback) => { callback(0); return 0 }, IS_REACT_ACT_ENVIRONMENT: true }
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  testing = await import('@testing-library/react/pure')
  server = Bun.serve({ port: 0, async fetch(request) {
    if (request.method === 'PUT') {
      const submitted = await request.json() as InquiryReview
      submissions.push(submitted)
      if (submitted.revision !== remote.revision) return Response.json({ detail: 'Review conflict' }, { status: 409 })
      remote = { ...submitted, revision: (remote.revision ?? 0) + 1 }
      return Response.json(remote)
    }
    return Response.json({ ...analysis, review: remote })
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

function setup(initial: AnalysisResponse = analysis) {
  remote = initial.review!
  submissions = []
  const api = createApi(`${server.url}api`)
  api.instance.defaults.adapter = 'fetch'
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  clients.push(queryClient)
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() })
  function Wrapper({ children }: { children: ReactNode }) {
    return <RouterContextProvider router={router}><QueryClientProvider client={queryClient}><ApiProvider client={api}>{children}</ApiProvider></QueryClientProvider></RouterContextProvider>
  }
  const hook = testing.renderHook(() => {
    const query = useQuery({ queryKey: ['inquiry-analysis', 'inquiry'], initialData: initial,
      queryFn: async () => (await api.requests.getInquiryAnalysisRequestsInquiryIdAnalysisGet('inquiry')).data })
    const review = useInquiryReview('inquiry', query.data)
    const sections = useReviewSections(review.editor)
    return { ...review, sections }
  }, { wrapper: Wrapper })
  return { ...hook, queryClient, Wrapper }
}

function allFields(editor: ReviewEditor) {
  return [...editor.groups.customerFields, ...editor.groups.inquiryFields, ...editor.positions.flatMap((position) => position.fields)]
}

test('clicking the field card selects its input while action buttons keep their own behavior', () => {
  let selections = 0
  let confirmations = 0
  const view = testing.render(<ExtractedField entry={{ id: 'material', kind: 'material', field: { value: '1.4841', status: 'present', sources: [] } }}
    highlights={[]} review={{ value: '1.4841', confirmed: false }} onSelect={() => {}} onChange={() => {}}
    onFocus={() => { selections++ }} onConfirm={() => { confirmations++ }} onReset={() => {}} />)
  const input = view.getByLabelText('Werkstoff')
  const card = input.closest('div.rounded-lg')!
  testing.fireEvent.click(card)
  expect(document.activeElement).toBe(input)
  expect(selections).toBe(1)
  testing.act(() => (input as HTMLElement).blur())
  testing.fireEvent.click(view.getByText('Offen'))
  expect(document.activeElement).toBe(input)
  expect(selections).toBe(2)
  testing.act(() => (input as HTMLElement).blur())
  testing.fireEvent.click(view.getByRole('button', { name: /Werkstoff:/ }))
  expect(confirmations).toBe(1)
  expect(selections).toBe(2)
})

test('the mounted review adopts clean query refreshes and saves the current revision', async () => {
  const { result, queryClient } = setup()
  remote = { revision: 1, fields: { customer: { value: 'Remote GmbH', confirmed: true } }, customer_id: null }
  await testing.act(() => queryClient.invalidateQueries({ queryKey: ['inquiry-analysis', 'inquiry'] }))
  await testing.waitFor(() => expect(result.current.editor.fields.value(allFields(result.current.editor)[0]).value).toBe('Remote GmbH'))
  expect(result.current.persistence.dirty).toBe(false)
  testing.act(() => result.current.editor.fields.view(allFields(result.current.editor)[0]).onChange('Local GmbH'))
  testing.act(() => result.current.persistence.save())
  await testing.waitFor(() => expect(result.current.persistence.dirty).toBe(false))
  expect(submissions[0].revision).toBe(1)
  expect(remote.revision).toBe(2)
})

test('a mounted stale save keeps edits, fetches the new revision and explicitly reapplies local changes', async () => {
  const { result } = setup()
  const requirements = allFields(result.current.editor).find((entry) => entry.id === 'requirements')!
  testing.act(() => result.current.editor.fields.view(requirements).onChange('3.2'))
  remote = { revision: 1, fields: { customer: { value: 'Remote GmbH', confirmed: true } }, customer_id: 'remote-customer' }
  testing.act(() => result.current.persistence.save())
  await testing.waitFor(() => expect(result.current.persistence.canResolveConflict).toBe(true))
  expect(result.current.persistence.conflict).toBe(true)
  expect(result.current.editor.fields.value(requirements).value).toBe('3.2')
  testing.act(() => result.current.persistence.save())
  expect(submissions).toHaveLength(1)
  testing.act(() => result.current.persistence.reapply())
  expect(result.current.persistence.conflict).toBe(false)
  expect(result.current.editor.customerId).toBe('remote-customer')
  expect(result.current.editor.fields.value(requirements).value).toBe('3.2')
  testing.act(() => result.current.persistence.save())
  await testing.waitFor(() => expect(result.current.persistence.dirty).toBe(false))
  expect(submissions.map((submission) => submission.revision)).toEqual([0, 1])
  expect(remote.fields?.customer.value).toBe('Remote GmbH')
  expect(remote.fields?.requirements.value).toBe('3.2')
})

test('the mounted review keeps field, citation and document navigation in sync', () => {
  const { result } = setup()
  const requirements = allFields(result.current.editor).find((entry) => entry.id === 'requirements')!
  testing.act(() => result.current.editor.fields.view(requirements).onFocus())
  expect(result.current.source.navigation.source?.id).toBe('attachment')
  expect(result.current.source.navigation.active?.fieldId).toBe('requirements')
  testing.act(() => result.current.editor.setOnlyOpen(true))
  testing.act(() => result.current.source.navigation.selectHighlight(result.current.source.highlights[0]))
  expect(result.current.editor.fields.onlyOpen).toBe(false)
  expect(result.current.editor.fields.view(requirements).selected).toBe(true)
  testing.act(() => result.current.source.navigation.selectDocument('email'))
  expect(result.current.source.navigation.active).toBeUndefined()
  expect(result.current.editor.fields.view(requirements).selected).toBe(false)
})

test.each([false, true])('field navigation respects reduced motion (%s) and preserves keyboard focus', (reducedMotion) => {
  const { result } = setup()
  const nativeMatchMedia = window.matchMedia
  const input = document.createElement('input')
  input.id = 'review-requirements'
  const scrolls: ScrollIntoViewOptions[] = []
  input.scrollIntoView = (options) => { scrolls.push(options as ScrollIntoViewOptions) }
  document.body.append(input)
  window.matchMedia = (query) => {
    const media = nativeMatchMedia.call(window, query)
    if (query === '(prefers-reduced-motion: reduce)') Object.defineProperty(media, 'matches', { value: reducedMotion })
    return media
  }
  try {
    testing.act(() => result.current.source.navigation.selectHighlight(result.current.source.highlights[0]))
    expect(scrolls).toEqual([{ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' }])
    expect(document.activeElement).toBe(input)
  } finally {
    input.remove()
    window.matchMedia = nativeMatchMedia
  }
})

test('editing a field preserves the source viewer and untouched field props', () => {
  const { result } = setup()
  const [customer, , requirements] = allFields(result.current.editor)
  testing.act(() => result.current.editor.fields.view(requirements).onFocus())
  const navigation = result.current.source.navigation
  const untouched = result.current.editor.fields.view(requirements)
  const highlights = result.current.source.highlights

  testing.act(() => result.current.editor.fields.view(customer).onChange('Local GmbH'))

  expect(result.current.editor.fields.value(customer).value).toBe('Local GmbH')
  expect(result.current.source.navigation).toBe(navigation)
  expect(result.current.source.highlights).toBe(highlights)
  const next = result.current.editor.fields.view(requirements)
  for (const key of Object.keys(untouched) as (keyof typeof untouched)[]) {
    expect(next[key]).toBe(untouched[key])
  }
  testing.act(() => result.current.source.navigation.selectDocument('email'))
  expect(result.current.source.navigation.source?.id).toBe('email')
  expect(result.current.editor.fields.view(requirements).selected).toBe(false)
})

test('the save shortcut submits the latest edits and prevents duplicate pending saves', async () => {
  const { result } = setup()
  const customer = allFields(result.current.editor)[0]
  testing.act(() => result.current.editor.fields.view(customer).onChange('First edit'))
  testing.act(() => result.current.editor.fields.view(customer).onChange('Latest edit'))
  const shortcut = new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
  testing.act(() => { window.dispatchEvent(shortcut) })
  expect(shortcut.defaultPrevented).toBe(true)
  testing.act(() => { window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', metaKey: true })) })
  await testing.waitFor(() => expect(result.current.persistence.dirty).toBe(false))
  expect(submissions).toHaveLength(1)
  expect(submissions[0].fields?.customer.value).toBe('Latest edit')
})

const itemField = { value: 'Rohr', status: 'present' as const, sources: [] }
const withArticle: AnalysisResponse = {
  ...analysis,
  extraction: {
    ...analysis.extraction!,
    items: [{ article: itemField, material: itemField, dimensions: itemField, quantity: itemField, unit: itemField,
      requirements: itemField, alternatives: itemField, certificates: itemField }],
  },
}

test.each([
  ['Kundendaten', 'customerFields'],
  ['Anfragedaten', 'inquiryFields'],
  ['Artikel', 'articleFields'],
] as const)('the %s section action confirms only that section, including collapsed positions', (label, group) => {
  const initial: AnalysisResponse = {
    ...withArticle,
    extraction: { ...withArticle.extraction!, items: [withArticle.extraction!.items[0], structuredClone(withArticle.extraction!.items[0])] },
  }
  const { result, Wrapper } = setup(initial)
  const view = testing.render(<ExtractionPanel editor={result.current.editor} />, { wrapper: Wrapper })
  const button = view.getByRole('button', { name: `${label} als geprüft markieren`, exact: true })
  expect(button.closest('[data-slot="accordion-content"]')).toBeNull()

  testing.fireEvent.click(button)

  const entries = result.current.editor.groups[group]
  const ids = new Set(entries.map((entry) => entry.id))
  expect(entries.length).toBeGreaterThan(0)
  for (const entry of allFields(result.current.editor)) {
    expect(result.current.editor.fields.value(entry).confirmed).toBe(ids.has(entry.id))
  }
  expect(result.current.editor.positions.every((position) => position.confirmed)).toBe(group === 'articleFields')
  expect(result.current.persistence.dirty).toBe(true)
  expect(submissions).toHaveLength(0)
})

test('confirming all includes hidden fields, preserves corrections and assignments, and allows individual changes', async () => {
  const { result } = setup(withArticle)
  const requirements = allFields(result.current.editor).find((entry) => entry.id === 'requirements')!
  testing.act(() => result.current.editor.fields.view(requirements).onChange('3.2'))
  testing.act(() => result.current.editor.fields.view(requirements).onConfirm())
  testing.act(() => result.current.editor.selectCustomer('customer'))
  testing.act(() => result.current.editor.selectArticle('item-0-article', 'variant'))
  testing.act(() => result.current.editor.setOnlyOpen(true))

  testing.act(() => result.current.editor.confirmAll())

  expect(result.current.editor.openCount).toBe(0)
  expect(result.current.editor.unconfirmedPositions).toBe(0)
  expect(allFields(result.current.editor).every((entry) => result.current.editor.fields.value(entry).confirmed)).toBe(true)
  expect(result.current.editor.fields.value(requirements).value).toBe('3.2')
  expect(result.current.editor.customerId).toBe('customer')
  expect(result.current.editor.positions[0].selectedId).toBe('variant')
  expect(result.current.persistence.dirty).toBe(true)
  expect(submissions).toHaveLength(0)

  testing.act(() => result.current.editor.fields.view(requirements).onConfirm())
  expect(result.current.editor.openCount).toBe(1)
  expect(result.current.editor.fields.value(requirements).confirmed).toBe(false)
  testing.act(() => result.current.persistence.save())
  await testing.waitFor(() => expect(result.current.persistence.dirty).toBe(false))
  expect(remote.fields?.requirements).toEqual({ value: '3.2', confirmed: false })
  expect(remote.fields?.['item-0-article'].confirmed).toBe(true)
})

test('inline assignments are available before checking fields, and completion confirms and saves once', async () => {
  const { result } = setup(withArticle)
  expect(result.current.editor.openCount).toBeGreaterThan(0)
  testing.act(() => result.current.editor.selectCustomer('customer'))
  testing.act(() => result.current.editor.selectArticle('item-0-article', 'variant'))
  expect(result.current.persistence.assignmentsComplete).toBe(true)
  testing.act(() => { result.current.persistence.complete(); result.current.persistence.complete() })
  await testing.waitFor(() => expect(result.current.persistence.dirty).toBe(false))
  expect(submissions).toHaveLength(1)
  expect(submissions[0].customer_id).toBe('customer')
  expect(submissions[0].article_ids).toEqual({ 'item-0-article': 'variant' })
  expect(Object.values(submissions[0].fields!).every((field) => field.confirmed)).toBe(true)
  expect(submissions[0].position_confirmations?.['item-0-article'].origin).toBe('manual')
  expect(result.current.editor.openCount).toBe(0)
  expect(result.current.editor.unconfirmedPositions).toBe(0)
})

test('completion requires assignments and remains blocked on concurrent changes', async () => {
  const { result } = setup(withArticle)
  testing.act(() => result.current.persistence.complete())
  expect(submissions).toHaveLength(0)
  testing.act(() => result.current.editor.selectCustomer('customer'))
  testing.act(() => result.current.editor.selectArticle('item-0-article', 'variant'))
  remote = { ...remote, revision: 1 }
  testing.act(() => result.current.persistence.complete())
  await testing.waitFor(() => expect(result.current.persistence.conflict).toBe(true))
  expect(result.current.persistence.dirty).toBe(true)
  testing.act(() => result.current.persistence.complete())
  expect(submissions).toHaveLength(1)
})

test('review navigation opens only the selected customer, request or article section', () => {
  const { result } = setup(withArticle)
  expect(result.current.sections.expanded).toEqual(['customer'])
  const requirements = allFields(result.current.editor).find((entry) => entry.id === 'requirements')!
  testing.act(() => result.current.editor.fields.view(requirements).onFocus())
  expect(result.current.sections.expanded).toEqual(['request'])
  testing.act(() => result.current.source.navigation.selectHighlight(result.current.source.highlights[0]))
  expect(result.current.sections.expanded).toEqual(['request'])
  const article = allFields(result.current.editor).find((entry) => entry.id === 'item-0-article')!
  testing.act(() => result.current.editor.fields.view(article).onFocus())
  expect(result.current.sections.expanded).toEqual(['item-0'])
  testing.act(() => result.current.editor.fields.view(allFields(result.current.editor)[0]).onFocus())
  expect(result.current.sections.expanded).toEqual(['customer'])
})

test('position edits keep assignments, suggestions and confirmations scoped together', () => {
  const items = Array.from({ length: 11 }, () => structuredClone(withArticle.extraction!.items[0]))
  const keys = items.map((_, index) => `item-${index}-article`)
  const initial: AnalysisResponse = {
    ...withArticle,
    extraction: { ...withArticle.extraction!, items, matching: { targets: keys.map((field_id) => ({
      field_id, candidates: [{ id: field_id, number: field_id, label: 'Rohr', status: 'matching' }],
    })) } },
    review: { revision: 1, customer_id: 'customer', article_ids: Object.fromEntries(keys.map((key) => [key, key])),
      position_confirmations: Object.fromEntries(keys.map((key) => [key, { origin: 'manual' as const, confirmed_at: '2026-10-28T12:00:00Z' }])) },
  }
  const { result } = setup(initial)
  expect(result.current.persistence.assignmentsComplete).toBe(true)
  const quantity = result.current.editor.positions[1].fields.find((entry) => entry.kind === 'quantity')!
  testing.act(() => result.current.editor.fields.view(quantity).onChange('20'))
  expect(result.current.editor.positions[1].selectedId).toBeUndefined()
  expect(result.current.editor.positions[1].suggestions).toEqual([])
  expect(result.current.editor.positions[1].status.origin).toBe('system')
  expect(result.current.editor.positions[10].selectedId).toBe(keys[10])
  expect(result.current.editor.positions[10].suggestions).toHaveLength(1)
  expect(result.current.editor.positions[10].status.origin).toBe('manual')
  expect(result.current.persistence.assignmentsComplete).toBe(false)
  testing.act(() => result.current.editor.fields.view(quantity).onFocus())
  expect(result.current.sections.expanded).toEqual(['item-1'])
  testing.act(() => result.current.editor.confirmAndNext(result.current.editor.positions[1].fields))
  expect(result.current.editor.positions[1].confirmed).toBe(true)
  const shared = allFields(result.current.editor).find((entry) => entry.id === 'requirements')!
  testing.act(() => result.current.editor.fields.view(shared).onChange('3.2'))
  expect(result.current.editor.positions.every((position) => position.status.origin === 'system')).toBe(true)
  expect(result.current.editor.positions.every((position) => position.suggestions.length === 0)).toBe(true)
  expect(result.current.editor.positions[10].selectedId).toBe(keys[10])
  expect(initial.review!.article_ids![keys[1]]).toBe(keys[1])
})
