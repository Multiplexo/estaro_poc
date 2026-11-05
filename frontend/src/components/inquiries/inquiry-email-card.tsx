import { MailIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadingSource } from '@/lib/inquiry-models'

const headerSections = new Set(['sender', 'to', 'cc', 'subject', 'date'])

export function InquiryEmailCard({ emails }: { emails: ReadingSource[] }) {
  return <Card className="min-w-0 rounded-lg shadow-sm">
    <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><MailIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>E-Mail</h2></CardTitle></CardHeader>
    <CardContent className="space-y-6">
      {emails.length ? emails.map((email) => <article key={email.id} aria-label={`E-Mail ${email.filename}`} className="space-y-4 text-sm [overflow-wrap:anywhere]">
        {emails.length > 1 ? <h3 className="font-medium">{email.filename}</h3> : null}
        <div className="space-y-1 border-b pb-4 text-muted-foreground">
          {(email.sections ?? []).filter((section) => headerSections.has(section.id)).map((section) => <p key={section.id}>{section.text}</p>)}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">{(email.sections ?? []).filter((section) => !headerSections.has(section.id)).map((section) => section.text).join('\n') || 'Kein E-Mail-Text vorhanden.'}</div>
      </article>) : <p className="text-sm text-muted-foreground">Für diese Anfrage liegt keine E-Mail vor.</p>}
    </CardContent>
  </Card>
}
