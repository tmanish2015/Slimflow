import ExcelJS from 'exceljs'
import type { ConfigurationResult } from './configuratorApi'

/** Writes the current configuration's BOM to a downloaded .xlsx file — pure
 * client-side write of data the API already returned, no server round trip. */
export async function exportBomToExcel(result: ConfigurationResult) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('BOM')

  sheet.columns = [
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Qty', key: 'quantity', width: 10 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Unit cost', key: 'unit_cost', width: 12 },
    { header: 'Total', key: 'total_cost', width: 12 },
    { header: 'Formula', key: 'formula', width: 45 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const line of result.bomLines) {
    sheet.addRow(line)
  }

  sheet.addRow({})
  sheet.addRow({ item: 'Material cost', total_cost: result.materialCost })
  sheet.addRow({ item: 'Waste', total_cost: result.wasteCost })
  sheet.addRow({ item: 'Total cost', total_cost: result.totalCost })
  sheet.addRow({ item: 'Selling price', total_cost: result.sellingPrice })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.name || 'configuration'}-BOM.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
