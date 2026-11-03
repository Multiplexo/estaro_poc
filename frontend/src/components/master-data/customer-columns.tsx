import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Customer } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Customer>()

function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  return value.split('-').reverse().join('.')
}

export const customerColumns = helper.columns([
  helper.accessor('customer_number', { meta: { width: 150 }, header: 'Kundennummer' }),
  helper.accessor('matchcode', { meta: { width: 200 }, header: 'Matchcode' }),
  helper.accessor('salutation', { meta: { width: 150 }, header: 'Anrede' }),
  helper.accessor('name', { meta: { width: 320 }, header: 'Name' }),
  helper.accessor('name_addition', { meta: { width: 260 }, header: 'Namenszusatz' }),
  helper.accessor('print_process_variant_code', { meta: { width: 240 }, header: 'Druckprozess-Variante (Code)' }),
  helper.accessor('address_group_code', { meta: { width: 200 }, header: 'Adressgruppe (Code)' }),
  helper.accessor('address_group_name', { meta: { width: 220 }, header: 'Adressgruppe' }),
  helper.accessor('country_code', { meta: { width: 130 }, header: 'Land (Code)' }),
  helper.accessor('country_name', { meta: { width: 150 }, header: 'Land' }),
  helper.accessor('postal_code', { meta: { width: 90 }, header: 'PLZ' }),
  helper.accessor('city', { meta: { width: 180 }, header: 'Ort' }),
  helper.accessor('phone', { meta: { width: 180 }, header: 'Telefon' }),
  helper.accessor('currency_code', { meta: { width: 160 }, header: 'Währung (Code)' }),
  helper.accessor('currency_name', { meta: { width: 180 }, header: 'Währung' }),
  helper.accessor('payment_terms_code', { meta: { width: 230 }, header: 'Zahlungskondition (Code)' }),
  helper.accessor('payment_terms_name', { meta: { width: 300 }, header: 'Zahlungskondition' }),
  helper.accessor('representative_code', { meta: { width: 150 }, header: 'Vertreter' }),
  helper.accessor('price_list_code', { meta: { width: 170 }, header: 'Preisliste (Code)' }),
  helper.accessor('price_list_name', { meta: { width: 220 }, header: 'Preisliste' }),
  helper.accessor('customer_group_code', { meta: { width: 190 }, header: 'Kundengruppe (Code)' }),
  helper.accessor('customer_group_name', { meta: { width: 240 }, header: 'Kundengruppe' }),
  helper.accessor('language_code', { meta: { width: 150 }, header: 'Sprache (Code)' }),
  helper.accessor('language_name', { meta: { width: 170 }, header: 'Sprache' }),
  helper.accessor('delivery_blocked', { meta: { width: 130 }, header: 'Liefersperre', cell: (info) => info.getValue() ? 'Ja' : 'Nein' }),
  helper.accessor('vat_id', { meta: { width: 180 }, header: 'USt-ID-Nr.' }),
  helper.accessor('is_active', { meta: { width: 90 }, header: 'Status', cell: (info) => info.getValue() ? 'Aktiv' : 'Inaktiv' }),
  helper.accessor('taxation_type_code', { meta: { width: 210 }, header: 'Besteuerungsart (Code)' }),
  helper.accessor('taxation_type_name', { meta: { width: 240 }, header: 'Besteuerungsart' }),
  helper.accessor('admission_date', { meta: { width: 140 }, header: 'Aufnahme', cell: (info) => formatDate(info.getValue()) }),
  helper.accessor('eu_country_code', { meta: { width: 200 }, header: 'EU-Länderkürzel (Code)' }),
  helper.accessor('eu_country_name', { meta: { width: 220 }, header: 'EU-Länderkürzel (Name)' }),
  helper.accessor('invoice_cycle_code', { meta: { width: 200 }, header: 'Rechnungskreis (Code)' }),
  helper.accessor('invoice_cycle_name', { meta: { width: 220 }, header: 'Rechnungskreis' }),
  helper.accessor('discount_list_code', { meta: { width: 180 }, header: 'Rabattliste (Code)' }),
  helper.accessor('discount_list_name', { meta: { width: 220 }, header: 'Rabattliste' }),
])
