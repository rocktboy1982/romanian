import type { Metadata } from 'next'
import GroceryOrdersClient from '@/components/pages/grocery-orders-client'

export const metadata: Metadata = {
  title: 'Istoric Comenzi | MareChef.ro',
}

export default function GroceryOrdersPage() {
  return <GroceryOrdersClient />
}
