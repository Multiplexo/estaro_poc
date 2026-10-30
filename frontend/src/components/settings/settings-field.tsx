import { useId, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

type Props = ComponentProps<typeof Input> & { label: string; hint?: string }

export function SettingsField({ label, hint, id: providedId, value, ...props }: Props) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Input id={id} aria-describedby={hint ? `${id}-hint` : undefined} value={typeof value === 'number' && Number.isNaN(value) ? '' : value} {...props} />
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
