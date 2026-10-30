import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de } },
  lng: 'de',
  fallbackLng: 'de',
  supportedLngs: ['de'],
  initAsync: false,
  interpolation: { escapeValue: false },
})

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof de }
  }
}

export { useTranslation } from 'react-i18next'
export default i18n
