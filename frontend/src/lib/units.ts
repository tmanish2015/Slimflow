export function toMillimetres(value: number, unit: 'mm' | 'cm' | 'in' | null): number {
  if (unit === 'cm') return value * 10
  if (unit === 'in') return value * 25.4
  return value
}
