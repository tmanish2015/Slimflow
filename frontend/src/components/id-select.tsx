import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

/** Select over a list of {id, name} master rows — ids round-trip as strings
 * through base-ui's Select (its value type), converted back to number for
 * the rest of the app's plain-number state. */
export function IdSelect<T extends { id: number }>({
  value,
  onChange,
  options,
  labelKey = 'name' as keyof T,
  placeholder = 'Select…',
}: {
  value: number | ''
  onChange: (v: number) => void
  options: T[]
  labelKey?: keyof T
  placeholder?: string
}) {
  // Select.Value resolves its displayed label from this `items` map, not by
  // scanning rendered Item children — the popup unmounts when closed, so
  // there'd be nothing to scan. Without it, the trigger shows the raw id.
  const items = Object.fromEntries(options.map((o) => [String(o.id), String(o[labelKey])]))

  return (
    // Always pass a defined string (never `undefined`) — Base UI decides
    // controlled-vs-uncontrolled from whether the *first* render's value is
    // defined, so toggling to `undefined` for the "nothing selected" state
    // flips it to uncontrolled and then back once something is picked,
    // which Base UI (rightly) treats as a bug and warns about.
    <Select items={items} value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {String(o[labelKey])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
