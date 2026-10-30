import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '@/components/data-table'
import { articleColumns } from '@/components/master-data/article-columns'
import { articlesResource } from '@/lib/master-data'

export const Route = createFileRoute('/artikel')({ component: ArticlesPage })

function ArticlesPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Artikel</h1>
        <p className="text-muted-foreground">Artikelstamm mit Varianten, Lagerbestand und Status.</p>
      </div>
      <DataTable resource={articlesResource} columns={articleColumns} caption="Artikelstamm" emptyMessage="Keine Artikel vorhanden." />
    </section>
  )
}
