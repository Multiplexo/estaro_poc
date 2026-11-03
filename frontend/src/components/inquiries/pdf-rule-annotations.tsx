import { ruleCategories, ruleSectionLabel, type Rule } from '@/lib/rules'

export function PdfRuleAnnotations({ rules, marking, onSelect }: { rules: Rule[]; marking: boolean; onSelect: (rule: Rule) => void }) {
  return <div className="pointer-events-none absolute inset-0 z-20" role="group" aria-label="Regel-Markierungen im PDF">
    {rules.flatMap((rule) => (rule.source?.rectangles ?? []).map((rectangle, index) => <button key={`${rule.id}-${index}`} type="button"
      aria-label={`Regel bearbeiten: ${rule.title} (${ruleCategories[rule.category]}, ${ruleSectionLabel(rule.section)}, ${rule.is_active ? 'aktiv' : 'inaktiv'})`}
      title={`${rule.title} · ${ruleCategories[rule.category]} · ${ruleSectionLabel(rule.section)}${rule.is_active ? '' : ' · Inaktiv'}`}
      disabled={marking} onClick={() => onSelect(rule)}
      className={`absolute rounded-sm border border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-700 ${marking ? '' : 'pointer-events-auto cursor-pointer hover:bg-blue-400/30'} ${rule.is_active ? 'bg-blue-400/20' : 'border-dashed opacity-50'}`}
      style={{ left: `${rectangle.x * 100}%`, top: `${rectangle.y * 100}%`, width: `${rectangle.width * 100}%`, height: `${rectangle.height * 100}%` }} />))}
  </div>
}
