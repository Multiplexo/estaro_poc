import type { ReviewFieldEditor } from '@/hooks/use-inquiry-review'
import type { AnalysisField } from '@/lib/inquiry-analysis'
import { ExtractedField } from './extracted-field'

export function ReviewFieldGroup({ fields, editor }: { fields: AnalysisField[]; editor: ReviewFieldEditor }) {
  return <div className="@container bg-muted/30 p-4"><div className="grid items-start gap-3 @min-[28rem]:grid-cols-2">{fields.filter((entry) => !editor.onlyOpen || !editor.value(entry).confirmed).map((entry) => <ExtractedField key={entry.id} {...editor.view(entry)} />)}</div></div>
}
