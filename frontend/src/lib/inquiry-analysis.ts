import i18n from '../i18n'
import type { ExtractionResult, SourceReference, VerifiedField, VerifiedItem } from './inquiry-models'

const sourceColor = '#f59e0b'

export const sourceAccent = '#c2410c'

export const fieldStyles = {
  customer: { labelKey: 'fields.customer', color: sourceColor },
  customer_number: { labelKey: 'fields.customer_number', color: sourceColor },
  customer_location: { labelKey: 'fields.customer_location', color: sourceColor },
  contact_name: { labelKey: 'fields.contact_name', color: sourceColor },
  contact_email: { labelKey: 'fields.contact_email', color: sourceColor },
  contact_phone: { labelKey: 'fields.contact_phone', color: sourceColor },
  inquiry_number: { labelKey: 'fields.inquiry_number', color: sourceColor },
  document_number: { labelKey: 'fields.document_number', color: sourceColor },
  offer_valid_until: { labelKey: 'fields.offer_valid_until', color: sourceColor },
  reference_number: { labelKey: 'fields.reference_number', color: sourceColor },
  delivery_date: { labelKey: 'fields.delivery_date', color: sourceColor },
  article: { labelKey: 'fields.article', color: sourceColor },
  material: { labelKey: 'fields.material', color: sourceColor },
  dimensions: { labelKey: 'fields.dimensions', color: sourceColor },
  quantity: { labelKey: 'fields.quantity', color: sourceColor },
  unit: { labelKey: 'fields.unit', color: sourceColor },
  requirements: { labelKey: 'fields.requirements', color: sourceColor },
  alternatives: { labelKey: 'fields.alternatives', color: sourceColor },
  certificates: { labelKey: 'fields.certificates', color: sourceColor },
} as const

export type FieldKind = keyof typeof fieldStyles
export const keyFieldKinds = new Set<FieldKind>([
  'customer', 'inquiry_number', 'document_number', 'reference_number', 'delivery_date', 'offer_valid_until',
  'article', 'material', 'dimensions', 'quantity', 'unit',
])
export type AnalysisField = { id: string; kind: FieldKind; field: VerifiedField }
export type Highlight = { id: string; fieldId: string; label: string; color: string; source: SourceReference }

export const itemFieldKinds = ['article', 'material', 'dimensions', 'quantity', 'unit', 'requirements', 'alternatives', 'certificates'] as const satisfies readonly (keyof VerifiedItem)[]
export const customerIdentityKinds = ['customer', 'customer_number', 'customer_location'] as const
export const customerFieldKinds = [...customerIdentityKinds, 'contact_name', 'contact_email', 'contact_phone'] as const
export const offerFieldKinds = ['offer_valid_until', 'delivery_date'] as const
export const inquiryFieldKinds = [...customerFieldKinds, 'inquiry_number', 'document_number', 'reference_number', 'requirements', ...offerFieldKinds] as const satisfies readonly (keyof ExtractionResult)[]

export function isCustomerIdentityField(id: string) {
  return customerIdentityKinds.some((kind) => kind === id)
}

export type AnalysisResult = Pick<ExtractionResult, typeof inquiryFieldKinds[number] | 'items'>

export function analysisFields(result: AnalysisResult): AnalysisField[] {
  return [
    ...inquiryFieldKinds.flatMap((kind) => result[kind] ? [{ id: kind, kind, field: result[kind] }] : []),
    ...result.items.flatMap((item, index) => itemFieldKinds.map((kind) => ({
      id: `item-${index}-${kind}`, kind, field: item[kind],
    }))),
  ]
}

export function fieldHighlights(fields: AnalysisField[]): Highlight[] {
  return fields.flatMap(({ id, kind, field }) => (field.sources ?? []).map((source, index) => ({
    id: `${id}-source-${index}`, fieldId: id, label: i18n.t(fieldStyles[kind].labelKey), color: fieldStyles[kind].color, source,
  })))
}

export function sectionSegments(text: string, highlights: Highlight[]) {
  const characters = Array.from(text)
  const boundaries = [...new Set([0, characters.length, ...highlights.flatMap(({ source }) => [source.start, source.end])])].sort((a, b) => a - b)
  return boundaries.slice(0, -1).map((start, index) => ({
    start, text: characters.slice(start, boundaries[index + 1]).join(''),
    highlights: highlights.filter(({ source }) => source.start <= start && source.end > start),
  }))
}
