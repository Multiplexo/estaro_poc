export const unavailableMessage = 'Diese Funktion wird von der aktuellen API nicht angeboten.'

export function unavailable<T>(): Promise<T> {
  return Promise.reject(new Error(unavailableMessage))
}
