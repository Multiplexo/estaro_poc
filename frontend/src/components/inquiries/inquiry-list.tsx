import { lazy, Suspense } from 'react'
import { Inbox, List, Table2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useInquiryInbox } from '@/hooks/use-inquiry-inbox'
import { useDeleteInquiry } from '@/hooks/use-delete-inquiry'
import { InquiryCards } from './inquiry-cards'
import { InquiryTable } from './inquiry-table'
import { InquiryToolbar } from './inquiry-toolbar'
import { InquiryPagination } from './inquiry-pagination'
import { InquiryQueue } from './inquiry-queue'
import { Upload } from './upload'

const DeleteInquiryDialog = lazy(() => import('./delete-inquiry-dialog').then((module) => ({ default: module.DeleteInquiryDialog })))

export function InquiryList() {
  const inbox = useInquiryInbox()
  const deletion = useDeleteInquiry()
  const { query } = inbox

  return <section aria-labelledby="inquiries-heading" className="space-y-6">
    <header className="page-heading">
      <div>
        <p className="page-eyebrow">Anfragenmanagement</p>
        <h1 id="inquiries-heading" className="flex items-center gap-3 text-3xl font-semibold tracking-tight">Alle Anfragen{query.data ? <span className="rounded-md border bg-card px-2 py-0.5 text-sm font-medium tabular-nums text-muted-foreground">{query.data.total}</span> : null}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ihre Anfragen, Dokumente und Ergebnisse an einem Ort.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><InquiryQueue deletion={deletion} /><Upload /></div>
    </header>
    <Tabs value={inbox.view} onValueChange={(value) => inbox.setView(String(value))} className="workspace-panel gap-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Inbox aria-hidden="true" className="size-4 text-muted-foreground" />Anfrageübersicht</div>
        <TabsList aria-label="Ansicht der Anfragen" className="h-9!">
          <TabsTrigger value="list" className="px-3"><List aria-hidden="true" />Liste</TabsTrigger>
          <TabsTrigger value="table" className="px-3"><Table2 aria-hidden="true" />Tabelle</TabsTrigger>
        </TabsList>
      </div>
      <InquiryToolbar inbox={inbox} />
      {query.isError ? <p role="alert" className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{query.error.message} Die Übersicht konnte nicht aktualisiert werden und wird automatisch erneut geladen.</p> : null}
      {query.isPending ? <p role="status" className="px-6 py-16 text-sm text-muted-foreground">Anfragen werden geladen …</p> : null}
      {query.data?.items.length === 0 ? <div className="px-6 py-20 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border bg-muted/40"><Inbox aria-hidden="true" className="size-5 text-muted-foreground" /></span>
        <p className="font-medium">{inbox.search || inbox.status !== 'all' ? 'Keine passenden Anfragen' : 'Noch keine fertig verarbeiteten Anfragen'}</p>
        <p className="mt-2 text-sm text-muted-foreground">{inbox.search || inbox.status !== 'all' ? 'Passe die Suche oder den Statusfilter an.' : 'Neue Uploads erscheinen zuerst unter „Verarbeitung“ und danach hier.'}</p>
      </div> : null}
      <TabsContent value="list" aria-busy={query.isFetching || inbox.waiting}>
        {query.data?.items.length ? <InquiryCards inquiries={query.data.items} deletion={deletion} disabled={query.isPlaceholderData || inbox.waiting} /> : null}
      </TabsContent>
      <TabsContent value="table" aria-busy={query.isFetching || inbox.waiting}>
        {query.data?.items.length ? <InquiryTable inquiries={query.data.items} deletion={deletion} inbox={inbox} /> : null}
      </TabsContent>
      <div className="border-t px-4 py-3"><InquiryPagination page={inbox.page} total={query.data?.total} isPlaceholderData={query.isPlaceholderData || inbox.waiting} onPageChange={inbox.setPage} /></div>
    </Tabs>
    {deletion.inquiry ? <Suspense fallback={<p role="status">Bestätigung wird geladen …</p>}><DeleteInquiryDialog deletion={deletion} /></Suspense> : null}
  </section>
}
