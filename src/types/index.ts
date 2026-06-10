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
  code?: string
  stock?: number
  stock_initial?: number
  sort_order?: number
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  initial_quantity: number
  unit: string
}

export interface ExtraFicha {
  id: string
  qr_code: string
  alias: string
  description: string
}

export interface StockEntry {
  id: string
  menu_item_id: string
  menu_item_name: string
  type: 'adjust' | 'set' | 'reset' | 'entry' | 'open'
  qty_before: number
  qty_after: number
  inserted_by: string
  inserted_at: Date
}

export interface AppUser {
  id: string
  name: string
  role: string
  allowed_views: string[]
}

export interface MediaSlide {
  id: string
  url: string
  type: 'image' | 'video' | 'youtube'
  title: string
  duration: number
  order: number
  enabled: boolean
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
  | 'media-slides'
  | 'admin'
