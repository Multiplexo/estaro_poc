import type { ApiClient } from './api'
import type { Article as ArticleResponse, Customer as CustomerResponse, RequestParams } from './generated/Api'

export type Article = ArticleResponse
export type Customer = CustomerResponse

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
