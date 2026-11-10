import { afterAll, beforeAll, expect, test } from 'bun:test'
import { isCancel } from 'axios'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiProvider } from '../src/contexts/api-provider'
import { useApi } from '../src/hooks/use-api'
import { createApi } from '../src/lib/api'
import { articlesResource, customersResource } from '../src/lib/master-data'

let server: ReturnType<typeof Bun.serve>
let uploads: { name: string; text: string }[] = []

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/api/extractions') {
        const form = await request.formData()
        uploads.push(...await Promise.all(form.getAll('file').map(async (value) => {
          const file = value as File
          return { name: file.name, text: await file.text() }
        })))
        return Response.json({ id: 'inquiry-1' }, { status: 201 })
      }
      if (url.pathname === '/api/inquiries/inquiry-1/documents/document-1') {
        return new Response('%PDF-example', { headers: { 'Content-Type': 'application/pdf' } })
      }
      if (url.pathname.includes('/missing')) {
        return Response.json({ detail: 'Dokument nicht gefunden.' }, { status: 404 })
      }
      if (url.pathname.endsWith('/validation-error')) {
        return Response.json({ detail: [{ msg: 'Invalid value' }] }, { status: 422 })
      }
      if (url.pathname.endsWith('/server-error')) {
        return new Response('Service unavailable', { status: 503 })
      }
      if (['/api/inquiries', '/api/articles', '/api/customers'].includes(url.pathname)) {
        expect(url.searchParams.get('limit')).toBe('25')
        expect(url.searchParams.get('offset')).toBe('50')
        return Response.json([])
      }
      return new Response('Unknown endpoint', { status: 404 })
    },
  })
})

afterAll(() => server.stop(true))

function client() {
  const api = createApi(`${server.url}api`)
  // Use the browser-compatible adapter so downloads are Blobs in Bun, too.
  api.instance.defaults.adapter = 'fetch'
  return api
}

test('generated lists and table resources send pagination through the API base URL', async () => {
  const api = client()
  const query = { limit: 25, offset: 50 }
  const inquiries = await api.inquiries.listInquiries(query)
  const articles = await articlesResource.load(api, query, {})
  const customers = await customersResource.load(api, query, {})

  expect(inquiries.data).toEqual([])
  expect(articles.data).toEqual([])
  expect(customers.data).toEqual([])
})

test('extraction uploads preserve file names and contents in the file field', async () => {
  uploads = []
  const api = client()
  for (const file of [
    new File(['%PDF-example'], 'anfrage.pdf', { type: 'application/pdf' }),
    new File(['message-example'], 'anfrage.msg', { type: 'application/vnd.ms-outlook' }),
  ]) {
    await api.extractions.extraction({ file })
  }

  expect(uploads).toEqual([
    { name: 'anfrage.pdf', text: '%PDF-example' },
    { name: 'anfrage.msg', text: 'message-example' },
  ])
})

test('document downloads preserve binary response data', async () => {
  const response = await client().inquiries.downloadInquiryDocument(
    'inquiry-1', 'document-1', { format: 'blob' },
  )

  expect(response.data).toBeInstanceOf(Blob)
  expect(await response.data.text()).toBe('%PDF-example')
})

test('JSON and download errors preserve the backend detail message', async () => {
  const api = client()
  await expect(api.inquiries.getInquiryById('missing')).rejects.toThrow('Dokument nicht gefunden.')
  await expect(api.inquiries.downloadInquiryDocument(
    'missing', 'document-1', { format: 'blob' },
  )).rejects.toThrow('Dokument nicht gefunden.')
})

test('validation and non-JSON failures have readable HTTP error messages', async () => {
  const api = client()
  await expect(api.inquiries.getInquiryById('validation-error')).rejects.toThrow('Anfrage fehlgeschlagen (HTTP 422).')
  await expect(api.inquiries.getInquiryById('server-error')).rejects.toThrow('Anfrage fehlgeschlagen (HTTP 503).')
})

test('network errors have a readable connection error message', async () => {
  const api = client()
  api.instance.defaults.env = { fetch: () => Promise.reject(new TypeError('Failed to fetch')) }
  await expect(api.inquiries.listInquiries()).rejects.toThrow('Das Backend ist nicht erreichbar. Bitte erneut versuchen.')
})

test('query cancellation remains a cancellation error', async () => {
  const controller = new AbortController()
  controller.abort()
  try {
    await client().inquiries.listInquiries({}, { signal: controller.signal })
    throw new Error('Expected request cancellation')
  } catch (error) {
    expect(isCancel(error)).toBe(true)
  }
})

function ApiConsumer() {
  return <span>{useApi().instance.defaults.baseURL}</span>
}

test('the API context supplies the configured client and requires a provider', () => {
  const api = createApi('/custom-api')
  expect(renderToStaticMarkup(<ApiProvider client={api}><ApiConsumer /></ApiProvider>)).toContain('/custom-api')
  expect(renderToStaticMarkup(<ApiProvider><ApiConsumer /></ApiProvider>)).toContain('/api')
  expect(() => renderToStaticMarkup(<ApiConsumer />)).toThrow('useApi must be used within an ApiProvider')
})
