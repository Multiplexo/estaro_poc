import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '@/components/data-table'
import { customerColumns } from '@/components/master-data/customer-columns'
import { customersResource } from '@/lib/master-data'

export const Route = createFileRoute('/kunden')({ component: CustomersPage })

function CustomersPage() {
  return (
    <section className="space-y-6">
      <header className="page-heading"><div className="space-y-2">
        <p className="page-eyebrow">Stammdaten</p>
        <h1 className="text-3xl font-semibold tracking-tight">Kunden</h1>
        <p className="text-sm text-muted-foreground">Kundenstamm mit Kontaktdaten, Status und Liefersperren.</p>
      </div></header>
      <DataTable resource={customersResource} columns={customerColumns} caption="Kundenstamm" emptyMessage="Keine Kunden vorhanden." searchLabel="Kunden durchsuchen" searchPlaceholder="Kundennummer, Name, Ort oder Matchcode …" />
    </section>
  )
}
