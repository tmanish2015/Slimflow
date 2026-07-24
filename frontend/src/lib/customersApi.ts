import * as customers from '~/services/customers'

export type { Customer, CreateCustomerInput } from '~/services/customers'

export const customersApi = {
  search(searchTerm: string) {
    return customers.searchCustomers(searchTerm)
  },
  get(id: number) {
    return customers.getCustomer(id)
  },
  create(input: customers.CreateCustomerInput) {
    return customers.createCustomer(input)
  },
}
