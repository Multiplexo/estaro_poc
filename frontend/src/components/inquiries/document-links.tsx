import { Button } from '@/components/ui/button'
import { useDocumentDownload } from '@/hooks/use-document-download'
import type { Inquiry } from '@/lib/api'

export function DocumentLinks({ inquiry }: { inquiry: Inquiry }) {
  const { download, pending, error } = useDocumentDownload(inquiry.id)
  return (
    <div className="space-y-1">
      {inquiry.documents.map((document) => (
        <Button
          key={document.id}
          variant="link"
          size="sm"
          className="flex h-auto max-w-64 justify-start px-0 text-left whitespace-normal break-all"
          disabled
          onClick={() => void download(document)}
        >
          {pending === document.id ? 'Wird geladen …' : document.filename}
        </Button>
      ))}
      {error ? (
        <p
          role="alert"
          className="max-w-64 whitespace-normal text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
