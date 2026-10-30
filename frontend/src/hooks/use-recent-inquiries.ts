import { useInquiryOverviews } from './use-inquiry-overviews'

export function useRecentInquiries() {
  return useInquiryOverviews({ offset: 0, limit: 10, sort: 'newest' })
}
