import { useTranslation } from '@/i18n'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AccessoryChange, AdditionalPosition, AgentMatchCandidate } from '@/lib/inquiry-processing'

interface AccessoryRow {
  entityId: string
  number: string
  label: string
  added: boolean
}

export function MatchingAccessories({ positionIndex, suggestions, added, disabled, onChange }: {
  positionIndex: number; suggestions: AgentMatchCandidate[]; added: AdditionalPosition[]
  disabled: boolean; onChange: (change: AccessoryChange) => void
}) {
  const { t } = useTranslation()
  const rows = new Map<string, AccessoryRow>()
  for (const suggestion of suggestions) {
    rows.set(suggestion.entity_id, { entityId: suggestion.entity_id, number: suggestion.number, label: suggestion.label || t('common.withoutDescription'), added: false })
  }
  for (const position of added.filter((item) => item.zu_position === positionIndex)) {
    rows.set(position.entity_id, { entityId: position.entity_id, number: position.artikel ?? '', label: position.bezeichnung || t('common.withoutDescription'), added: true })
  }
  if (!rows.size) return null

  return <section aria-labelledby={`accessories-${positionIndex}`} className="mt-4 overflow-hidden rounded-lg border bg-card">
    <div className="border-b px-4 py-2">
      <h5 id={`accessories-${positionIndex}`} className="text-xs font-medium text-muted-foreground">{t('matching.accessories.title')}</h5>
      <p className="text-xs text-muted-foreground">{t('matching.accessories.description')}</p>
    </div>
    <ul className="divide-y">
      {[...rows.values()].map((row) => <li key={row.entityId} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="min-w-32 flex-1">
          <span className="block text-sm font-medium [overflow-wrap:anywhere]">{row.label}</span>
          <span className="block text-xs text-muted-foreground">{row.number}{row.added ? ` · ${t('matching.accessories.quantity')}` : ''}</span>
        </span>
        {row.added ? <>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Check aria-hidden="true" className="size-3.5" />{t('matching.accessories.added')}</span>
          <Button variant="ghost" size="sm" disabled={disabled} aria-label={t('matching.accessories.removeLabel', { label: row.label })}
            onClick={() => onChange({ position_index: positionIndex, entity_id: row.entityId, selected: false })}><X aria-hidden="true" />{t('matching.accessories.remove')}</Button>
        </> : <Button variant="outline" size="sm" disabled={disabled} aria-label={t('matching.accessories.addLabel', { label: row.label })}
          onClick={() => onChange({ position_index: positionIndex, entity_id: row.entityId, selected: true })}><Plus aria-hidden="true" />{t('matching.accessories.add')}</Button>}
      </li>)}
    </ul>
  </section>
}
