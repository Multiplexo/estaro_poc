import { DownloadIcon, FileTextIcon, MailIcon, PaperclipIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDocumentDownload } from '@/hooks/use-document-download'
import type { InquiryResponse } from '@/lib/inquiry-models'

export function InquiryFilesCard({ inquiry }: { inquiry: InquiryResponse }) {
  const { download, pending, error } = useDocumentDownload(inquiry.id)
  return <Card className="min-w-0 rounded-lg shadow-sm">
    <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><PaperclipIcon aria-hidden="true" className="size-4 text-muted-foreground" /><h2>Dateien</h2><Badge variant="secondary" className="ml-auto">{inquiry.documents.length}</Badge></CardTitle></CardHeader>
    <CardContent>
      <ul className="divide-y">
        {inquiry.documents.map((document) => <li key={document.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          {document.file_type === 'msg' ? <MailIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /> : <FileTextIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1"><p className="text-sm [overflow-wrap:anywhere]">{document.filename}</p><p className="mt-1 text-xs text-muted-foreground">{document.parent_document_id ? 'Anhang · ' : ''}{document.file_type.toUpperCase()}{pending === document.id ? ' · Wird geladen …' : ''}</p></div>
          <Button variant="ghost" size="icon" className="size-10" aria-label={`${document.filename} herunterladen`} title="Herunterladen" disabled onClick={() => void download(document)}><DownloadIcon /></Button>
        </li>)}
      </ul>
      {!inquiry.documents.length ? <p className="text-sm text-muted-foreground">Keine Dateien vorhanden.</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </CardContent>
  </Card>
}
