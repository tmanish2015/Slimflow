export function toMillimetres(value: number, unit: 'mm' | 'cm' | 'in' | 'ft' | null): number {
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * 25.4
  if (unit === 'ft') return value * 304.8
  return value
}
