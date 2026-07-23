import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

/** Thin wrapper over shadcn's Select for the common "pick one of these
 * strings" case used across the app's editable tables (unit/kind/shape/…) —
 * keeps call sites to one line instead of repeating Trigger/Content/Item. */
export function SelectField<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T
  onValueChange: (v: T) => void
  options: readonly T[]
  className?: string
}) {
  // Select.Value resolves its label from this `items` map, not by scanning
  // rendered Item children (the popup unmounts when closed) — value equals
  // label here so it's a no-op in practice, but wrong to omit on principle
  // (see id-select.tsx, where the same omission showed the raw id).
  const items = Object.fromEntries(options.map((o) => [o, o]))

  return (
    <Select items={items} value={value} onValueChange={(v) => onValueChange(v as T)}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
