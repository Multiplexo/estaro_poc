import { inquirySchemaFields, type InquiryFieldPath } from './inquiry-schema'
import type { InquiryData } from './generated/Api'
import type { AnalysisResponse, InquiryResponse, ReadingSource } from './inquiry-models'
import { analysisFields, customerIdentityKinds, itemFieldKinds } from './inquiry-analysis'
import { reviewDraft, reviewedField } from './inquiry-review'
import { inquiryTrafficLight } from './inquiry-traffic-light'
import { createInquiryEvaluation } from './inquiry-evaluation'

export function emailHeader(source: ReadingSource | undefined, id: string) {
  return source?.sections?.find((section) => section.id === id)?.text.replace(/^[^:]+:\s*/, '').trim() || null
}

function extractionNotice(inquiry: InquiryResponse, analysis: AnalysisResponse) {
  if (analysis.extraction) return null
  switch (inquiry.processing_job?.status) {
    case 'cancelled': return 'Die Verarbeitung wurde abgebrochen. Vorhandene E-Mails und Dateien stehen unten zur Verfügung.'
    case 'cancelling': return 'Die Verarbeitung wird abgebrochen. Die Anfrage kann anschließend gelöscht werden.'
    case 'failed': return 'Die Verarbeitung ist fehlgeschlagen. Vorhandene E-Mails und Dateien stehen unten zur Verfügung.'
    case 'queued':
    case 'running': return 'Die Anfrage wird verarbeitet. Die Informationen werden automatisch ergänzt.'
    default: return 'Für diese Anfrage liegen noch keine extrahierten Informationen vor.'
  }
}

export function inquiryDetail(inquiry: InquiryResponse, analysis: AnalysisResponse) {
  const sources = analysis.sources ?? []
  const emails = sources.filter((source) => source.file_type !== 'pdf')
  const email = emails.find((source) => !source.parent_document_id) ?? emails[0]
  const result = analysis.extraction
  const review = reviewDraft(analysis.review)
  const fields = result ? analysisFields(result) : []
  const extractionValues = new Map(fields.map(({ id, field }) => [id, field.value?.trim() || null]))
  extractionValues.set('document_number', extractionValues.get('document_number') || extractionValues.get('inquiry_number') || null)
  extractionValues.set('data:kundeninformationen.zusatz', [extractionValues.get('contact_email'), extractionValues.get('contact_phone')].filter(Boolean).join('\n') || null)
  const evaluation = result ? createInquiryEvaluation(result, fields) : undefined
  const summary = evaluation?.summary(review)
  const values = new Map(fields.map((entry) => [entry.id, reviewedField(entry, review).value]))
  const value = (id: string) => values.get(id)?.trim() || null
  const storedValue = (stored: string | null | undefined, id: string) => id in review.fields ? value(id) : stored ?? value(id)
  const data: InquiryData = structuredClone(inquiry.daten ?? {})
  if (result) {
    data.kundeninformationen = { ...data.kundeninformationen, name: storedValue(data.kundeninformationen?.name, 'customer'), kunde: storedValue(data.kundeninformationen?.kunde, 'customer_number'), ansprechpartner: value('contact_name'), zusatz: [value('contact_email'), value('contact_phone')].filter(Boolean).join('\n') || null,
      ort: { ...data.kundeninformationen?.ort, stadt: storedValue(data.kundeninformationen?.ort?.stadt, 'customer_location') } }
    data.beleginformationen = { ...data.beleginformationen, lieferdatum: value('delivery_date') }
    data.belegdetails = { ...data.belegdetails, ihreBelegnummer: value('document_number') || value('inquiry_number'), belegZu: value('reference_number') }
    data.angebotsdetails = { ...data.angebotsdetails, angebotGueltigBis: value('offer_valid_until') }
    data.kopftext = value('requirements')
  }
  if (result) data.positionen = result.items.map((_, index) => ({
    ...data.positionen?.[index],
    bezeichnung: storedValue(data.positionen?.[index]?.bezeichnung, `item-${index}-article`), bezeichnung2: storedValue(data.positionen?.[index]?.bezeichnung2, `item-${index}-material`),
    dimensionstext: value(`item-${index}-dimensions`), menge: value(`item-${index}-quantity`),
    mengeneinheit: storedValue(data.positionen?.[index]?.mengeneinheit, `item-${index}-unit`), langtext: value(`item-${index}-requirements`),
    zusatzinfos: value(`item-${index}-alternatives`), zeugnis: value(`item-${index}-certificates`),
  }))
  for (const [id, field] of Object.entries(review.fields)) {
    if (!id.startsWith('data:')) continue
    const parts = id.slice(5).split('.')
    let target: Record<string, unknown> = data as Record<string, unknown>
    for (const part of parts.slice(0, -1)) {
      if (!target[part] || typeof target[part] !== 'object') target[part] = {}
      target = target[part] as Record<string, unknown>
    }
    target[parts.at(-1)!] = field.value || null
  }
  const sections = new Map<string, { id: InquiryFieldPath; label: string; value: string | null }[]>()
  for (const definition of inquirySchemaFields) {
    let current: unknown = data
    for (const part of definition.path.split('.')) current = current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : null
    const group = sections.get(definition.groupLabel!) ?? []
    group.push({ id: definition.path, label: definition.label, value: typeof current === 'string' ? current : null })
    sections.set(definition.groupLabel!, group)
  }
  const positions = result?.items.map((_, index) => ({
    number: index + 1,
    fields: itemFieldKinds.map((kind) => ({ kind, value: kind === 'article' ? data.positionen?.[index]?.bezeichnung ?? null
      : kind === 'material' ? data.positionen?.[index]?.bezeichnung2 ?? null
        : kind === 'unit' ? data.positionen?.[index]?.mengeneinheit ?? null : value(`item-${index}-${kind}`) })),
    status: summary!.positionStatuses[index],
  })) ?? []
  const customerUnchanged = customerIdentityKinds.every((kind) => value(kind) === (result?.[kind]?.value?.trim() || null))
  const suggestions = customerUnchanged ? result?.customer_match : undefined
  const matchingCustomers = customerUnchanged ? result?.matching?.targets?.find((target) => target.field_id === 'customer')?.candidates ?? [] : []
  const customerId = review.customer_id ?? (matchingCustomers.length === 1 && matchingCustomers[0].status === 'matching'
    ? matchingCustomers[0].id
    : suggestions?.status === 'matched' && suggestions.candidates?.length === 1 ? suggestions.candidates[0].id : undefined)
  return {
    positionData: data.positionen ?? [],
    extractionValues,
    matchingProvenance: data.matching_provenance ?? {},
    sections: [...sections].map(([label, fields]) => ({ label, fields })),
    title: emailHeader(email, 'subject') || [value('customer'), value('inquiry_number') || value('reference_number')].filter(Boolean).join(' · ') || inquiry.documents.find((document) => !document.parent_document_id)?.filename || 'Anfrage',
    emails, customerId, customerName: data.kundeninformationen?.name ?? null, sender: emailHeader(email, 'sender'),
    reference: value('reference_number'), inquiryNumber: value('inquiry_number'), documentNumber: value('document_number'),
    offerValidUntil: value('offer_valid_until'), deliveryDate: value('delivery_date'), requirements: value('requirements'),
    customerNumber: data.kundeninformationen?.kunde ?? null, customerLocation: data.kundeninformationen?.ort?.stadt ?? null,
    contactName: value('contact_name'), contactEmail: value('contact_email'), contactPhone: value('contact_phone'),
    reviewStatus: summary?.reviewStatus ?? 'new', positions, confirmedPositions: summary?.confirmedPositions ?? 0,
    extractionNotice: extractionNotice(inquiry, analysis), matchingStatus: result?.matching?.status,
    openFields: summary?.openFields.length ?? 0,
    fieldCount: fields.length,
    trafficLight: summary?.trafficLight ?? inquiryTrafficLight([]),
  }
}

export type InquiryDetail = ReturnType<typeof inquiryDetail>
