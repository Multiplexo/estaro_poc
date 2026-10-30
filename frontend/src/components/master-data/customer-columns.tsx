import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Customer } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Customer>()

export const customerColumns = helper.columns([
  helper.accessor('customer_number', { meta: { width: 150 }, header: 'Kundennummer' }),
  helper.accessor('name', { meta: { width: 320 },
    header: 'Name',
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate">{row.original.name ?? '–'}</p>
        {row.original.name_addition ? <p className="truncate text-muted-foreground" title={row.original.name_addition}>{row.original.name_addition}</p> : null}
      </div>
    ),
  }),
  helper.accessor('matchcode', { meta: { width: 200 }, header: 'Matchcode' }),
  helper.accessor('postal_code', { meta: { width: 90 }, header: 'PLZ' }),
  helper.accessor('city', { meta: { width: 180 }, header: 'Ort' }),
  helper.accessor('country_name', { meta: { width: 150 }, header: 'Land' }),
  helper.accessor('phone', { meta: { width: 180 }, header: 'Telefon' }),
  helper.accessor('is_active', { meta: { width: 90 }, header: 'Status', cell: (info) => info.getValue() ? 'Aktiv' : 'Inaktiv' }),
  helper.accessor('delivery_blocked', { meta: { width: 130 }, header: 'Liefersperre', cell: (info) => info.getValue() ? 'Ja' : 'Nein' }),
])
