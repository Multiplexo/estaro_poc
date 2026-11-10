import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { InquiryEmailCard } from '../src/components/inquiries/inquiry-email-card'
import { InquiryDetailsCard } from '../src/components/inquiries/inquiry-details-card'
import { InquiryDetailSidebar } from '../src/components/inquiries/inquiry-detail-sidebar'
import { inquiryDetail } from '../src/lib/inquiry-detail'
import type { AnalysisResponse, InquiryResponse } from '../src/lib/inquiry-models'

const inquiry: InquiryResponse = {
  id: 'inquiry', created_at: '2026-10-28T10:00:00Z', documents: [], file_types: [], processing_job: null,
}
const field = { value: 'Rohr', status: 'present' as const }
const analysis: AnalysisResponse = {
  sources: [{ id: 'email', file_type: 'msg', filename: 'Anfrage.msg', sections: [
    { id: 'sender', text: 'Von: Anna Müller <anna@example.org>' },
    { id: 'subject', text: 'Betreff: Anfrage: Edelstahl' },
    { id: 'body-1', text: 'Bitte 20 m anbieten. <script>bad()</script>' },
  ] }],
  extraction: {
    customer: { ...field, value: 'Muster GmbH' }, reference_number: { ...field, value: 'A-42' },
    requirements: field, delivery_date: { ...field, value: 'KW 48' },
    items: [{ article: field, material: field, dimensions: field, quantity: field, unit: field, requirements: field, alternatives: field, certificates: field }],
    customer_match: { status: 'matched', note: '', candidates: [{ id: 'suggested', customer_number: '100', name: 'Muster GmbH', reason: '' }] },
    metadata: { model: 'test', processing_version: 'test' },
  },
}

test('overview preserves saved corrections and position approval while the review is incomplete', () => {
  const detail = inquiryDetail(inquiry, { ...analysis, review: {
    revision: 2, fields: {
      delivery_date: { value: '03.12.2026', confirmed: true },
      'item-0-quantity': { value: '20', confirmed: true },
    },
    position_confirmations: { 'item-0-article': { origin: 'manual', confirmed_at: '2026-10-28T11:00:00Z' } },
  } })
  expect(detail.deliveryDate).toBe('03.12.2026')
  expect(detail.positions[0].fields.find((entry) => entry.kind === 'quantity')?.value).toBe('20')
  expect(detail.reviewStatus).toBe('in_review')
  expect(detail.trafficLight).toMatchObject({ color: 'green', origin: 'manual' })
  expect(detail.confirmedPositions).toBe(1)
})

test('a corrected customer never restores the old master-data suggestion', () => {
  expect(inquiryDetail(inquiry, analysis).customerId).toBe('suggested')
  const corrected = { revision: 1, fields: { customer: { value: 'Anderer Kunde', confirmed: true } } }
  const detail = inquiryDetail(inquiry, { ...analysis, review: corrected })
  expect(detail.customerName).toBe('Anderer Kunde')
  expect(detail.customerId).toBeUndefined()
  expect(detail.reviewStatus).toBe('in_review')
  expect(inquiryDetail(inquiry, { ...analysis, review: { ...corrected, customer_id: 'selected' } }).customerId).toBe('selected')
})

test('email subject and sender preserve their contents and email markup remains plain text', () => {
  const detail = inquiryDetail(inquiry, analysis)
  expect(detail.title).toBe('Anfrage: Edelstahl')
  expect(detail.sender).toBe('Anna Müller <anna@example.org>')
  const html = renderToStaticMarkup(<InquiryEmailCard emails={detail.emails} />)
  expect(html).toContain('Bitte 20 m anbieten.')
  expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('role="tab')
})

test('inquiries without extraction or email stay readable and never appear completed or green', () => {
  const detail = inquiryDetail(inquiry, {})
  expect(detail.title).toBe('Anfrage')
  expect(detail.reviewStatus).toBe('new')
  expect(detail.trafficLight.color).toBe('yellow')
  expect(detail.positions).toEqual([])
  expect(detail.sender).toBeNull()
  expect(renderToStaticMarkup(<InquiryEmailCard emails={[]} />)).toContain('keine E-Mail')
})

test('quote and contact details display saved corrections and independent references', () => {
  const detail = inquiryDetail(inquiry, { ...analysis, extraction: { ...analysis.extraction!,
    customer_number: { ...field, value: 'K1' }, customer_location: { ...field, value: 'Duisburg' },
    contact_name: { ...field, value: 'Anna Müller' }, contact_email: { ...field, value: 'anna@example.org' },
    contact_phone: { ...field, value: '+49 203 12345' }, inquiry_number: { ...field, value: 'AN-42' },
    document_number: { ...field, value: 'BE-7' }, offer_valid_until: { ...field, value: '30.11.2026' },
  }, review: { fields: { contact_name: { value: 'Max Müller', confirmed: true } } } })
  const html = renderToStaticMarkup(<><InquiryDetailsCard detail={detail} /><InquiryDetailSidebar inquiry={inquiry} detail={detail} customerLoading={false} /></>)
  for (const value of ['K1', 'Duisburg', 'Max Müller', 'anna@example.org', '+49 203 12345', 'AN-42', 'BE-7', '30.11.2026', 'Angebot gültig bis']) expect(html).toContain(value)
  expect(detail.contactName).toBe('Max Müller')
})
