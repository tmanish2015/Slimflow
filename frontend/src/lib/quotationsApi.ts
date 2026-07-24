import * as quotations from '~/services/quotations'

export type { QuotationSummary } from '~/services/quotations'

export const quotationsApi = {
  list() {
    return quotations.listQuotations()
  },
}
