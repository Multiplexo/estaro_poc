import i18n from '../i18n'

export interface TrafficLight {
  color: 'green' | 'yellow' | 'red'
  origin: 'system' | 'manual'
  reasons: string[]
  confirmedAt?: string | null
}

export function inquiryTrafficLight(positions: TrafficLight[]): TrafficLight {
  const color = positions.some((position) => position.color === 'red') ? 'red' :
    positions.length === 0 || positions.some((position) => position.color === 'yellow') ? 'yellow' : 'green'
  const manual = positions.length > 0 && positions.every((position) => position.origin === 'manual')
  const counts = { green: 0, yellow: 0, red: 0 }
  for (const position of positions) counts[position.color]++
  return { color, origin: manual ? 'manual' : 'system', reasons: positions.length
    ? [i18n.t('traffic.summary', counts)]
    : [i18n.t('traffic.noPositions')] }
}
