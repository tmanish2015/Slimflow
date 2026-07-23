import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type AdminColumn, type AdminRow } from '@/lib/configuratorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
        <Link to="/" className="text-sm text-neutral-500 hover:underline">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Master Data Admin
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          One generic editor for every configurator table — add a system, finish, profile, rate, or
          rule row without a code change.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <select
            className="h-9 w-72 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={table}
            onChange={(e) => void loadTable(e.target.value)}
          >
            <option value="" disabled>
              Select table…
            </option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {table && (
        <Card>
          <CardHeader>
            <CardTitle>{table}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
                  <th className="py-1 pr-2">id</th>
                  {editableColumns.map((c) => (
                    <th key={c.name} className="pr-2">
                      {c.name}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={String(row.id)} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-1 pr-2 text-neutral-400">{String(row.id)}</td>
                    {editableColumns.map((c) => (
                      <td key={c.name} className="pr-2">
                        <Input
                          className="h-8 w-32 text-xs"
                          value={row[c.name] ?? ''}
                          onChange={(e) => updateCell(idx, c.name, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="flex gap-1 py-1">
                      <Button size="sm" variant="outline" onClick={() => save(row)}>
                        Save
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(row.id as number)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  {editableColumns.map((c) => (
                    <td key={c.name} className="pr-2 pt-2">
                      <Input
                        className="h-8 w-32 text-xs"
                        placeholder={c.name}
                        value={newRow[c.name] ?? ''}
                        onChange={(e) => setNewRow((prev) => ({ ...prev, [c.name]: e.target.value }))}
                      />
                    </td>
                  ))}
                  <td className="pt-2">
                    <Button size="sm" onClick={add}>
                      + Add
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
