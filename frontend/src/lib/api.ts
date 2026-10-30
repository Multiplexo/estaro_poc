import i18n from '../i18n'
import { isAxiosError, isCancel } from 'axios'
import { Api } from './generated/Api'

export type {
  DocumentResponse as DocumentReference,
  InquiryResponse as Inquiry,
  JobStatus,
  JobSummary as ProcessingJob,
  PageInquiryResponse as InquiryPage,
  PipelineStep,
} from './inquiry-models'
export type { FileType } from './generated/Api'

export type ApiClient = Api<unknown>

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createApi(baseURL = '/api'): ApiClient {
  const api = new Api<unknown>({ baseURL })
  api.instance.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error) || isCancel(error)) throw error

    let body: unknown = error.response?.data
    if (body instanceof Blob) {
      body = await body.text().then(JSON.parse).catch(() => null)
    }
    const detail = body && typeof body === 'object' && 'detail' in body
      ? body.detail
      : undefined

    throw new ApiError(
      typeof detail === 'string'
        ? detail
        : error.response
          ? i18n.t('common.requestError', { status: error.response.status })
          : i18n.t('common.backendUnavailable'),
      error.response?.status,
    )
  })
  return api
}
