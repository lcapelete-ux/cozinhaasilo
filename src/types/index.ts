export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

export interface OrderItem {
  name: string
  quantity: number
  sector: string
  price: number
  completed: boolean
}

export interface Order {
  id: string
  ticket_number: string
  status: OrderStatus
  items: OrderItem[]
  created_at: Date
  updated_at: Date
}

export interface User {
  id: string
  name: string
  password: string
  role: string
  allowed_views: string
}

export interface MenuItem {
  id: string
  name: string
  price: number
  sector: string
  category: string
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  unit: string
}

export interface ExtraFicha {
  id: string
  qr_code: string
  alias: string
  description: string
}

export interface AppUser {
  id: string
  name: string
  role: string
  allowed_views: string[]
}

export type ViewName =
  | 'reception'
  | 'kitchen'
  | 'kitchen-scanner'
  | 'kitchen-sectors'
  | 'display'
  | 'dispatch'
  | 'history'
  | 'inventory'
  | 'extra-fichas'
  | 'admin-dashboard'
  | 'admin'
