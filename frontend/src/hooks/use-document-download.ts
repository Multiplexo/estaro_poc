import { useState } from 'react'
import type { DocumentReference } from '@/lib/api'
import { unavailableMessage } from '@/lib/api-capabilities'

export function useDocumentDownload(_inquiryId: string) {
  const [error, setError] = useState<string | null>(null)
  return { download: async (_document: DocumentReference) => { setError(unavailableMessage) }, pending: null as string | null, error, available: false }
}
