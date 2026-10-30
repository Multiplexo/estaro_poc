import type { InputHTMLAttributes } from 'react'
import type { FieldKind } from './inquiry-analysis'

type InputAttributes = Pick<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'spellCheck'>

const inputAttributesByKind: Partial<Record<FieldKind, InputAttributes>> = {
  contact_email: { type: 'email', inputMode: 'email', spellCheck: false },
  contact_phone: { type: 'tel', inputMode: 'tel', spellCheck: false },
  quantity: { type: 'text', inputMode: 'decimal', spellCheck: false },
}
const proseFields = new Set<FieldKind>(['customer', 'customer_location', 'contact_name', 'article', 'requirements', 'alternatives'])

export function reviewFieldInputAttributes(kind: FieldKind): InputAttributes {
  return inputAttributesByKind[kind] ?? { type: 'text', spellCheck: proseFields.has(kind) }
}
