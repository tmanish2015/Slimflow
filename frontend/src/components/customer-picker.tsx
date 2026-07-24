import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { customersApi, type Customer } from '~/lib/customersApi'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'

/** Search-and-pick (or quick-add) a reusable customer record — used on both
 * the configurator result and the drawing BOM, since a quotation from
 * either module can be attached to the same customer. Kept as a single
 * component rather than duplicating the search/create UI in both pages. */
export function CustomerPicker({
  customerId,
  onChange,
  onCustomerLoaded,
}: {
  customerId: number | null
  onChange: (customerId: number | null) => void
  /** Fires whenever the resolved customer record changes — lets a parent
   * show name/GST/address in a print-visible quotation header without
   * re-fetching the same record itself. */
  onCustomerLoaded?: (customer: Customer | null) => void
}) {
  const [selected, setSelected] = useState<Customer | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newGst, setNewGst] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (customerId == null) {
      setSelected(null)
      onCustomerLoaded?.(null)
      return
    }
    customersApi.get(customerId).then((c) => {
      setSelected(c ?? null)
      onCustomerLoaded?.(c ?? null)
    })
  }, [customerId])

  useEffect(() => {
    if (!searching) return
    customersApi.search(searchTerm).then(setResults)
  }, [searching, searchTerm])

  const pick = (customer: Customer) => {
    setSelected(customer)
    setSearching(false)
    onChange(customer.id)
  }

  const clear = () => {
    setSelected(null)
    onChange(null)
  }

  const createAndPick = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await customersApi.create({ name: newName, phone: newPhone, gstNumber: newGst, address: newAddress })
      pick(created)
      setAddOpen(false)
      setNewName('')
      setNewPhone('')
      setNewGst('')
      setNewAddress('')
    } finally {
      setCreating(false)
    }
  }

  if (selected && !searching) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{selected.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[selected.phone, selected.gst_number].filter(Boolean).join(' · ') || 'No phone/GST on file'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setSearching(true)}>
            Change
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Remove customer" onClick={clear}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Search customer by name or phone…"
          value={searchTerm}
          onFocus={() => setSearching(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setSearching(true)
          }}
        />
        <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
          + New
        </Button>
      </div>
      {searching && (
        <div className="flex flex-col gap-1 rounded-lg border p-1">
          {results.length === 0 && <p className="p-2 text-xs text-muted-foreground">No customers yet — add one.</p>}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rounded-md p-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => pick(c)}
            >
              <div className="font-medium">{c.name}</div>
              {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
            </button>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>GST number</Label>
              <Input value={newGst} onChange={(e) => setNewGst(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Address</Label>
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createAndPick} disabled={!newName.trim() || creating}>
              {creating ? 'Saving…' : 'Save customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
