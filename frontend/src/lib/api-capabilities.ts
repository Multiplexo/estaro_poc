import i18n from '@/i18n'
export function unavailableMessage(): string {
  return i18n.t('common.unavailableFeature')
}

export function unavailable<T>(): Promise<T> {
  return Promise.reject(new Error(unavailableMessage()))
}
