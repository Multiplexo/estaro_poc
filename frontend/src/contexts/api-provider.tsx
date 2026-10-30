import { useState, type ReactNode } from 'react'
import { createApi, type ApiClient } from '@/lib/api'
import { ApiContext } from './api-context'

export function ApiProvider({ children, client }: { children: ReactNode; client?: ApiClient }) {
  const [defaultClient] = useState(() => client ?? createApi())
  return <ApiContext value={client ?? defaultClient}>{children}</ApiContext>
}
