import i18n from '@/i18n'
import { createColumnHelper } from '@tanstack/react-table'
import { dataTableFeatures } from '@/lib/data-table'
import type { Customer } from '@/lib/master-data'

const helper = createColumnHelper<typeof dataTableFeatures, Customer>()

function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export const customerColumns = helper.columns([
  helper.accessor('customer_number', { meta: { width: 150 }, header: () => i18n.t('fields.customer_number') }),
  helper.accessor('matchcode', { meta: { width: 200 }, header: () => i18n.t('masterData.matchcode') }),
  helper.accessor('salutation', { meta: { width: 150 }, header: () => i18n.t('masterData.columns.salutation') }),
  helper.accessor('name', { meta: { width: 320 }, header: () => i18n.t('masterData.columns.name') }),
  helper.accessor('name_addition', { meta: { width: 260 }, header: () => i18n.t('masterData.nameAddition') }),
  helper.accessor('print_process_variant_code', { meta: { width: 240 }, header: () => i18n.t('masterData.columns.print_process_variant_code') }),
  helper.accessor('address_group_code', { meta: { width: 200 }, header: () => i18n.t('masterData.columns.address_group_code') }),
  helper.accessor('address_group_name', { meta: { width: 220 }, header: () => i18n.t('masterData.columns.address_group_name') }),
  helper.accessor('country_code', { meta: { width: 130 }, header: () => i18n.t('masterData.columns.country_code') }),
  helper.accessor('country_name', { meta: { width: 150 }, header: () => i18n.t('masterData.country') }),
  helper.accessor('postal_code', { meta: { width: 90 }, header: () => i18n.t('masterData.columns.postal_code') }),
  helper.accessor('city', { meta: { width: 180 }, header: () => i18n.t('masterData.city') }),
  helper.accessor('phone', { meta: { width: 180 }, header: () => i18n.t('masterData.phone') }),
  helper.accessor('currency_code', { meta: { width: 160 }, header: () => i18n.t('masterData.columns.currency_code') }),
  helper.accessor('currency_name', { meta: { width: 180 }, header: () => i18n.t('masterData.currency') }),
  helper.accessor('payment_terms_code', { meta: { width: 230 }, header: () => i18n.t('masterData.columns.payment_terms_code') }),
  helper.accessor('payment_terms_name', { meta: { width: 300 }, header: () => i18n.t('masterData.columns.payment_terms_name') }),
  helper.accessor('representative_code', { meta: { width: 150 }, header: () => i18n.t('masterData.columns.representative_code') }),
  helper.accessor('price_list_code', { meta: { width: 170 }, header: () => i18n.t('masterData.columns.price_list_code') }),
  helper.accessor('price_list_name', { meta: { width: 220 }, header: () => i18n.t('masterData.priceList') }),
  helper.accessor('customer_group_code', { meta: { width: 190 }, header: () => i18n.t('masterData.columns.customer_group_code') }),
  helper.accessor('customer_group_name', { meta: { width: 240 }, header: () => i18n.t('masterData.customerGroup') }),
  helper.accessor('language_code', { meta: { width: 150 }, header: () => i18n.t('masterData.columns.language_code') }),
  helper.accessor('language_name', { meta: { width: 170 }, header: () => i18n.t('masterData.language') }),
  helper.accessor('delivery_blocked', { meta: { width: 130 }, header: () => i18n.t('common.deliveryBlocked'), cell: (info) => info.getValue() ? i18n.t('common.yes') : i18n.t('common.no') }),
  helper.accessor('vat_id', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.vat_id') }),
  helper.accessor('is_active', { meta: { width: 90 }, header: () => i18n.t('masterData.columns.is_active'), cell: (info) => info.getValue() ? i18n.t('common.active') : i18n.t('common.inactive') }),
  helper.accessor('taxation_type_code', { meta: { width: 210 }, header: () => i18n.t('masterData.columns.taxation_type_code') }),
  helper.accessor('taxation_type_name', { meta: { width: 240 }, header: () => i18n.t('masterData.columns.taxation_type_name') }),
  helper.accessor('admission_date', { meta: { width: 140 }, header: () => i18n.t('masterData.columns.admission_date'), cell: (info) => formatDate(info.getValue()) }),
  helper.accessor('eu_country_code', { meta: { width: 200 }, header: () => i18n.t('masterData.columns.eu_country_code') }),
  helper.accessor('eu_country_name', { meta: { width: 220 }, header: () => i18n.t('masterData.columns.eu_country_name') }),
  helper.accessor('invoice_cycle_code', { meta: { width: 200 }, header: () => i18n.t('masterData.columns.invoice_cycle_code') }),
  helper.accessor('invoice_cycle_name', { meta: { width: 220 }, header: () => i18n.t('masterData.columns.invoice_cycle_name') }),
  helper.accessor('discount_list_code', { meta: { width: 180 }, header: () => i18n.t('masterData.columns.discount_list_code') }),
  helper.accessor('discount_list_name', { meta: { width: 220 }, header: () => i18n.t('masterData.discountList') }),
])
