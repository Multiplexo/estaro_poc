import type { TFunction } from 'i18next'
import i18n from '@/i18n'
import type { InquiryDetail } from './inquiry-detail'
import type { InquiryPosition } from './generated/Api'
import type { FieldKind } from './inquiry-analysis'
import { positionSchemaFields, type InquiryFieldPath } from './inquiry-schema'

export type InquiryFieldSource = 'extraction' | 'customer' | 'article'

const inquiryFields: Partial<Record<InquiryFieldPath, FieldKind>> = {
  'kundeninformationen.name': 'customer', 'kundeninformationen.kunde': 'customer_number',
  'kundeninformationen.ort.stadt': 'customer_location', 'kundeninformationen.ansprechpartner': 'contact_name',
  'beleginformationen.lieferdatum': 'delivery_date', 'belegdetails.ihreBelegnummer': 'document_number',
  'belegdetails.belegZu': 'reference_number', 'angebotsdetails.angebotGueltigBis': 'offer_valid_until', 'kopftext': 'requirements',
}
const positionFields: Partial<Record<keyof InquiryPosition, FieldKind>> = { bezeichnung: 'article', bezeichnung2: 'material', dimensionstext: 'dimensions', menge: 'quantity', mengeneinheit: 'unit', langtext: 'requirements', zusatzinfos: 'alternatives', zeugnis: 'certificates' }

export function inquiryTableSections(detail: InquiryDetail, t: TFunction = i18n.t) {
  const sections = [
    { label: t('inquiries.extractedContactSection'), fields: [
      { id: 'anfragenummer', fieldId: 'inquiry_number', label: t('fields.inquiry_number'), value: detail.inquiryNumber },
      { id: 'kontakt.email', fieldId: 'contact_email', label: t('source.email'), value: detail.contactEmail },
      { id: 'kontakt.telefon', fieldId: 'contact_phone', label: t('masterData.phone'), value: detail.contactPhone },
    ] },
    ...detail.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field, fieldId: inquiryFields[field.id] ?? `data:${field.id}` })) })),
    ...detail.positionData.map((position, index) => ({
      label: t('overview.position', { number: index + 1 }), fields: positionSchemaFields.map((definition) => ({
        id: `positionen.${index}.${definition.path}`, label: t(definition.labelKey),
        fieldId: positionFields[definition.path] ? `item-${index}-${positionFields[definition.path]}` : `data:positionen.${index}.${definition.path}`,
        value: position[definition.path] ?? null,
      })),
    })),
  ]
  return sections.map((section) => ({ ...section, fields: section.fields.map((field) => {
    const match = detail.matchingProvenance[field.id]
    const automaticMatch = match?.value === field.value ? match : undefined
    const automaticSource: InquiryFieldSource | undefined = automaticMatch?.category ??
      (field.value?.trim() && detail.extractionValues.get(field.fieldId) === field.value.trim() ? 'extraction' : undefined)
    return { ...field, automaticMatch, automaticSource }
  }) }))
}
