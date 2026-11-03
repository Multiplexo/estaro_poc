import type { ReviewFieldEditor } from '@/hooks/use-inquiry-review'
import type { AnalysisField } from '@/lib/inquiry-analysis'
import { ExtractedField } from './extracted-field'

export function ReviewFieldGroup({ fields, editor }: { fields: AnalysisField[]; editor: ReviewFieldEditor }) {
  return <div className="@container p-3"><div className="grid items-start gap-x-3 gap-y-2 @min-[24rem]:grid-cols-2">{fields.filter((entry) => !editor.onlyOpen || !editor.value(entry).confirmed).map((entry) => <ExtractedField key={entry.id} {...editor.view(entry)} />)}</div></div>
}
