import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { adminApi, type AdminColumn, type AdminRow } from '~/lib/configuratorApi'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

function emptyRow(columns: AdminColumn[]): AdminRow {
  const row: AdminRow = {}
  for (const c of columns) {
    if (c.pk) continue
    row[c.name] = c.type === 'TEXT' ? '' : 0
  }
  return row
}

export function AdminPage() {
  const [tables, setTables] = useState<string[]>([])
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState<AdminColumn[]>([])
  const [rows, setRows] = useState<AdminRow[]>([])
  const [newRow, setNewRow] = useState<AdminRow>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getTables().then(setTables)
  }, [])

  const loadTable = async (t: string) => {
    setTable(t)
    setError(null)
    const [cols, data] = await Promise.all([adminApi.getSchema(t), adminApi.getRows(t)])
    setColumns(cols)
    setRows(data)
    setNewRow(emptyRow(cols))
  }

  const editableColumns = columns.filter((c) => !c.pk)

  const updateCell = (idx: number, col: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [col]: value } : r)))
  }

  const save = async (row: AdminRow) => {
    try {
      await adminApi.updateRow(table, row.id as number, row)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const remove = async (id: number) => {
    try {
      await adminApi.deleteRow(table, id)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed — other rows may reference it')
    }
  }

  const add = async () => {
    try {
      const created = await adminApi.createRow(table, newRow)
      setRows((prev) => [...prev, created])
      setNewRow(emptyRow(columns))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Master Data Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One generic editor for every configurator table — add a system, finish, profile, rate, or
          rule row without a code change.
        </p>
      </div>

      <Card>
        <CardContent>
          <Select
            items={Object.fromEntries(tables.map((t) => [t, t]))}
            value={table}
            onValueChange={(v) => v && void loadTable(v)}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select table…" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {table && (
        <Card>
          <CardHeader>
            <CardTitle>{table}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  {editableColumns.map((c) => (
                    <TableHead key={c.name}>{c.name}</TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={String(row.id)}>
                    <TableCell className="text-muted-foreground">{String(row.id)}</TableCell>
                    {editableColumns.map((c) => (
                      <TableCell key={c.name}>
                        <Input
                          className="h-8 w-32 text-xs"
                          value={row[c.name] ?? ''}
                          onChange={(e) => updateCell(idx, c.name, e.target.value)}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => save(row)}>
                          Save
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => remove(row.id as number)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">new</TableCell>
                  {editableColumns.map((c) => (
                    <TableCell key={c.name}>
                      <Input
                        className="h-8 w-32 text-xs"
                        placeholder={c.name}
                        value={newRow[c.name] ?? ''}
                        onChange={(e) => setNewRow((prev) => ({ ...prev, [c.name]: e.target.value }))}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button size="sm" onClick={add}>
                      + Add
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
