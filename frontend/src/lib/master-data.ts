import type { ApiClient } from './api'
import type { Article as ArticleResponse, Customer as CustomerResponse, RequestParams } from './generated/Api'

export type Article = ArticleResponse
export type Customer = CustomerResponse

const searchIndexes = new WeakMap<object[], string[][]>()

export function filterMasterData<T extends object>(items: T[], search: string): T[] {
  const term = search.trim().toLocaleLowerCase('de-DE')
  if (!term) return items

  let index = searchIndexes.get(items)
  if (!index) {
    index = items.map((item) => Object.values(item)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLocaleLowerCase('de-DE')))
    searchIndexes.set(items, index)
  }
  return items.filter((_, row) => index[row].some((value) => value.includes(term)))
}

export type PaginatedResource<T> = {
  queryKey: string
  load: (
    api: ApiClient,
    query: { limit: number; offset: number },
    params: RequestParams,
  ) => Promise<{ data: T[] }>
}

export const articlesResource: PaginatedResource<Article> = {
  queryKey: 'articles',
  load: (api, query, params) => api.articles.listArticles(query, params),
}

export const customersResource: PaginatedResource<Customer> = {
  queryKey: 'customers',
  load: (api, query, params) => api.customers.listCustomers(query, params),
}
