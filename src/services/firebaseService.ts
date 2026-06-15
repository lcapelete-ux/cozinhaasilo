import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import type { Order, OrderStatus, MenuItem, InventoryItem, ExtraFicha, User, StockEntry, MediaSlide } from '../types'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
)

let _app: FirebaseApp | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null

if (isFirebaseConfigured) {
  try {
    _app = initializeApp(firebaseConfig)
    _db = getFirestore(_app)
    _auth = getAuth(_app)
  } catch (e) {
    console.error('Firebase init failed:', e)
  }
}

export const db = _db!
export const auth = _auth!

export async function initAuth(): Promise<void> {
  if (!_auth) return
  await signInAnonymously(_auth)
}

// ── resolveFicha (Regra 2) ──────────────────────────────────────────────────

export async function resolveFicha(raw: string): Promise<string> {
  let cleaned = raw.trim()

  // Strip AIM Code Identifiers added by some scanners: ]Q2, ]C1, ]E0, etc.
  cleaned = cleaned.replace(/^\][A-Za-z]\d/, '')

  // Strip common control characters (STX, ETX, GS, RS, EOT)
  cleaned = cleaned.replace(/[\x02\x03\x1C\x1D\x1E\x04]/g, '')

  // Check ExtraFichas mapping using raw value first (custom QR codes registered by user)
  if (_db) {
    const q = query(collection(_db, 'extra_fichas'), where('qr_code', '==', raw.trim()))
    const snap = await getDocs(q)
    if (!snap.empty) {
      return snap.docs[0].data().alias as string
    }
  }

  try {
    const url = new URL(cleaned)
    const fichaParam = url.searchParams.get('ficha')
    if (fichaParam) cleaned = fichaParam
  } catch {
    // not a URL
  }

  cleaned = cleaned.replace(/^(FICHA[-_]?|LSC[-_]?)/i, '')

  const numericMatch = cleaned.match(/\d+/)
  if (numericMatch) {
    let num = parseInt(numericMatch[0], 10)
    // Fichas 101–133: strip leading "1" (101→1, 115→15, 133→33)
    if (num >= 101 && num <= 133) num = num - 100
    cleaned = String(num)
  }

  return cleaned
}

// ── Orders ─────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  return new Date()
}

function mapOrder(id: string, data: Record<string, unknown>): Order {
  return {
    id,
    ticket_number: data.ticket_number as string,
    status: data.status as OrderStatus,
    items: (data.items as Order['items']) ?? [],
    created_at: toDate(data.created_at),
    updated_at: toDate(data.updated_at),
  }
}

export function subscribeOrders(
  statuses: OrderStatus[],
  callback: (orders: Order[]) => void
) {
  if (!_db) return () => {}
  // Sem orderBy para evitar necessidade de índice composto no Firestore — ordenamos no cliente
  const q = query(collection(_db, 'orders'), where('status', 'in', statuses))
  return onSnapshot(q, (snap) => {
    const orders = snap.docs
      .map((d) => mapOrder(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    callback(orders)
  }, (err) => console.error('subscribeOrders error:', err))
}

export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  if (!_db) return () => {}
  const q = query(collection(_db, 'orders'), where('status', 'in', ['pending', 'preparing', 'ready', 'delivered']))
  return onSnapshot(q, (snap) => {
    const orders = snap.docs
      .map((d) => mapOrder(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    callback(orders)
  }, (err) => console.error('subscribeAllOrders error:', err))
}

export async function createOrder(ticket_number: string, items: Order['items']): Promise<string> {
  if (!_db) throw new Error('Firebase not configured')
  const ref = await addDoc(collection(_db, 'orders'), {
    ticket_number,
    status: 'pending',
    items,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  return ref.id
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
}

export async function advanceOrderStatus(orderId: string, currentStatus: OrderStatus): Promise<void> {
  if (!_db) return
  const next = STATUS_FLOW[currentStatus]
  if (!next) return
  await updateDoc(doc(_db, 'orders', orderId), {
    status: next,
    updated_at: serverTimestamp(),
  })
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  if (!_db) return
  await updateDoc(doc(_db, 'orders', orderId), {
    status,
    updated_at: serverTimestamp(),
  })
}

export async function deleteOrder(orderId: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'orders', orderId))
}

export async function getOrderByTicket(ticket: string): Promise<Order | null> {
  if (!_db) return null
  const q = query(collection(_db, 'orders'), where('ticket_number', '==', ticket))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return mapOrder(d.id, d.data() as Record<string, unknown>)
}

// Returns only non-delivered order for a ticket (supports ticket reuse)
export async function getActiveOrderByTicket(ticket: string): Promise<Order | null> {
  if (!_db) return null
  const q = query(
    collection(_db, 'orders'),
    where('ticket_number', '==', ticket),
    where('status', 'in', ['pending', 'preparing', 'ready'])
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return mapOrder(d.id, d.data() as Record<string, unknown>)
}

// Find product by its 4-digit code prefix
export async function getProductByCode(code: string): Promise<import('../types').MenuItem | null> {
  if (!_db) return null
  const q = query(collection(_db, 'menu_items'), where('code', '==', code))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<import('../types').MenuItem, 'id'>) }
}

export async function markItemCompleted(orderId: string, itemIndex: number, items: Order['items']): Promise<void> {
  if (!_db) return
  const updated = items.map((item, i) => i === itemIndex ? { ...item, completed: true } : item)
  await updateDoc(doc(_db, 'orders', orderId), { items: updated, updated_at: serverTimestamp() })
}

// ── Menu Items ──────────────────────────────────────────────────────────────

export function subscribeMenuItems(callback: (items: MenuItem[]) => void) {
  if (!_db) return () => {}
  return onSnapshot(collection(_db, 'menu_items'), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, 'id'>) }))
    items.sort((a, b) => {
      const ao = a.sort_order ?? 999999
      const bo = b.sort_order ?? 999999
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    callback(items)
  })
}

export async function addMenuItem(item: Omit<MenuItem, 'id'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'menu_items'), item)
}

export async function updateMenuItem(id: string, item: Partial<Omit<MenuItem, 'id'>>): Promise<void> {
  if (!_db) return
  await updateDoc(doc(_db, 'menu_items', id), item)
}

export async function deleteMenuItem(id: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'menu_items', id))
}

// ── Inventory ───────────────────────────────────────────────────────────────

export function subscribeInventory(callback: (items: InventoryItem[]) => void) {
  if (!_db) return () => {}
  return onSnapshot(collection(_db, 'inventory'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) })))
  })
}

export async function addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'inventory'), item)
}

export async function updateInventoryItem(id: string, item: Partial<Omit<InventoryItem, 'id'>>): Promise<void> {
  if (!_db) return
  await updateDoc(doc(_db, 'inventory', id), item)
}

export async function deleteInventoryItem(id: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'inventory', id))
}

// ── Extra Fichas ────────────────────────────────────────────────────────────

export function subscribeExtraFichas(callback: (fichas: ExtraFicha[]) => void) {
  if (!_db) return () => {}
  return onSnapshot(collection(_db, 'extra_fichas'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExtraFicha, 'id'>) })))
  })
}

export async function addExtraFicha(ficha: Omit<ExtraFicha, 'id'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'extra_fichas'), ficha)
}

export async function deleteExtraFicha(id: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'extra_fichas', id))
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function getUserByNamePassword(name: string, password: string): Promise<User | null> {
  if (!_db) return null
  const q = query(
    collection(_db, 'users'),
    where('name', '==', name),
    where('password', '==', password)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<User, 'id'>) }
}

export function subscribeUsers(callback: (users: User[]) => void) {
  if (!_db) return () => {}
  return onSnapshot(collection(_db, 'users'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) })))
  })
}

export async function addUser(user: Omit<User, 'id'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'users'), user)
}

export async function updateUser(id: string, user: Partial<Omit<User, 'id'>>): Promise<void> {
  if (!_db) return
  await updateDoc(doc(_db, 'users', id), user)
}

export async function deleteUser(id: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'users', id))
}

// ── Seed ────────────────────────────────────────────────────────────────────

export async function seedInitialData(): Promise<void> {
  if (!_db) return
  const usersSnap = await getDocs(collection(_db, 'users'))
  if (!usersSnap.empty) return

  const usersData: Omit<User, 'id'>[] = [
    { name: 'admin', password: 'admin123', role: 'admin', allowed_views: 'reception,kitchen,kitchen-scanner,kitchen-sectors,display,dispatch,history,inventory,extra-fichas,admin-dashboard,media-slides,admin' },
    { name: 'cozinha', password: 'cozinha123', role: 'kitchen', allowed_views: 'kitchen,kitchen-scanner,kitchen-sectors,display' },
    { name: 'recepcao', password: 'recepcao123', role: 'reception', allowed_views: 'reception,display' },
    { name: 'entrega', password: 'entrega123', role: 'dispatch', allowed_views: 'dispatch,display,history' },
  ]
  for (const u of usersData) await addDoc(collection(_db, 'users'), u)

  const menuData: Omit<MenuItem, 'id'>[] = [
    { name: 'Coxinha', price: 5.0, sector: 'Fritadeira', category: 'Salgados', code: '1001' },
    { name: 'Pastel de Carne', price: 5.0, sector: 'Fritadeira', category: 'Salgados', code: '1002' },
    { name: 'Pastel de Queijo', price: 5.0, sector: 'Fritadeira', category: 'Salgados', code: '1003' },
    { name: 'Rissole', price: 5.0, sector: 'Fritadeira', category: 'Salgados', code: '1004' },
    { name: 'Hambúrguer', price: 12.0, sector: 'Chapa', category: 'Lanches', code: '2001' },
    { name: 'X-Salada', price: 14.0, sector: 'Chapa', category: 'Lanches', code: '2002' },
    { name: 'Hot Dog', price: 10.0, sector: 'Chapa', category: 'Lanches', code: '2003' },
    { name: 'Milho Verde', price: 6.0, sector: 'Assados', category: 'Outros', code: '3001' },
    { name: 'Pamonha', price: 7.0, sector: 'Assados', category: 'Outros', code: '3002' },
    { name: 'Canjica', price: 6.0, sector: 'Assados', category: 'Outros', code: '3003' },
    { name: 'Quentão', price: 5.0, sector: 'Assados', category: 'Bebidas', code: '4001' },
    { name: 'Refrigerante', price: 4.0, sector: 'Assados', category: 'Bebidas', code: '4002' },
  ]
  for (const m of menuData) await addDoc(collection(_db, 'menu_items'), m)

  const inventoryData: Omit<InventoryItem, 'id'>[] = [
    { name: 'Farinha de trigo', quantity: 10, initial_quantity: 10, unit: 'kg' },
    { name: 'Óleo de soja', quantity: 20, initial_quantity: 20, unit: 'L' },
    { name: 'Pão de hambúrguer', quantity: 100, initial_quantity: 100, unit: 'un' },
    { name: 'Refrigerante lata', quantity: 200, initial_quantity: 200, unit: 'un' },
    { name: 'Milho verde', quantity: 50, initial_quantity: 50, unit: 'un' },
  ]
  for (const inv of inventoryData) await addDoc(collection(_db, 'inventory'), inv)
}

// ── Supabase Storage config ───────────────────────────────────────────────────

export interface SupabaseStorageConfig {
  url: string       // https://xxxx.supabase.co
  anon_key: string
  bucket: string    // e.g. "media"
}

export function subscribeStorageConfig(callback: (cfg: SupabaseStorageConfig | null) => void) {
  if (!_db) return () => {}
  return onSnapshot(doc(_db, 'config', 'storage'), (snap) => {
    if (!snap.exists()) { callback(null); return }
    callback(snap.data() as SupabaseStorageConfig)
  })
}

export async function setStorageConfig(cfg: SupabaseStorageConfig): Promise<void> {
  if (!_db) return
  await setDoc(doc(_db, 'config', 'storage'), cfg)
}

// ── File Upload (Supabase Storage) ────────────────────────────────────────────

export function uploadMediaFile(
  file: File,
  config: SupabaseStorageConfig,
  onProgress?: (pct: number) => void
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const uploadUrl = `${config.url}/storage/v1/object/${config.bucket}/${filename}`
  const publicUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${filename}`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${config.anon_key}`)
    xhr.setRequestHeader('apikey', config.anon_key)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(publicUrl)
      } else {
        let detail = ''
        try { detail = JSON.parse(xhr.responseText)?.message ?? '' } catch { /* */ }
        reject(new Error(`Supabase retornou ${xhr.status}${detail ? ` — ${detail}` : ''}`))
      }
    }
    xhr.onerror = () => reject(new Error('Erro de rede ao enviar para Supabase'))
    xhr.send(file)
  })
}

// ── Media Slides ─────────────────────────────────────────────────────────────

export function subscribeMediaSlides(callback: (slides: MediaSlide[]) => void) {
  if (!_db) return () => {}
  const q = query(collection(_db, 'media_slides'), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaSlide, 'id'>) }))
    )
  }, (err) => console.error('subscribeMediaSlides error:', err))
}

export async function addMediaSlide(slide: Omit<MediaSlide, 'id'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'media_slides'), slide)
}

export async function updateMediaSlide(id: string, data: Partial<Omit<MediaSlide, 'id'>>): Promise<void> {
  if (!_db) return
  await updateDoc(doc(_db, 'media_slides', id), data)
}

export async function deleteMediaSlide(id: string): Promise<void> {
  if (!_db) return
  await deleteDoc(doc(_db, 'media_slides', id))
}

// ── Stock Entries ────────────────────────────────────────────────────────────

export async function addStockEntry(entry: Omit<StockEntry, 'id' | 'inserted_at'>): Promise<void> {
  if (!_db) return
  await addDoc(collection(_db, 'stock_entries'), {
    ...entry,
    inserted_at: serverTimestamp(),
  })
}

export function subscribeStockEntries(callback: (entries: StockEntry[]) => void) {
  if (!_db) return () => {}
  const q = query(collection(_db, 'stock_entries'), orderBy('inserted_at', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          id: d.id,
          menu_item_id: data.menu_item_id as string,
          menu_item_name: data.menu_item_name as string,
          type: data.type as StockEntry['type'],
          qty_before: data.qty_before as number,
          qty_after: data.qty_after as number,
          inserted_by: data.inserted_by as string,
          inserted_at: toDate(data.inserted_at),
        }
      })
    )
  }, (err) => console.error('subscribeStockEntries error:', err))
}

// ── Active Session (live preview on KitchenSectors) ─────────────────────────

export interface ActiveSessionData {
  ficha: string
  items: { name: string; quantity: number; sector: string }[]
}

export async function setActiveSession(data: ActiveSessionData): Promise<void> {
  if (!_db) return
  await setDoc(doc(_db, 'active_sessions', 'current'), {
    ...data,
    updated_at: serverTimestamp(),
  })
}

export async function clearActiveSession(): Promise<void> {
  if (!_db) return
  await setDoc(doc(_db, 'active_sessions', 'current'), {
    ficha: '',
    items: [],
    updated_at: serverTimestamp(),
  })
}

export function subscribeActiveSession(callback: (data: ActiveSessionData | null) => void) {
  if (!_db) return () => {}
  return onSnapshot(doc(_db, 'active_sessions', 'current'), (snap) => {
    if (!snap.exists()) { callback(null); return }
    const d = snap.data()
    const ficha = d.ficha as string
    if (!ficha) { callback(null); return }
    callback({ ficha, items: d.items ?? [] })
  })
}

export async function clearAllOrders(): Promise<number> {
  if (!_db) return 0
  const snap = await getDocs(collection(_db, 'orders'))
  if (snap.empty) return 0
  let deleted = 0
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(_db)
    docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref))
    await batch.commit()
    deleted += docs.slice(i, i + 500).length
  }
  return deleted
}

export async function clearAllStockEntries(): Promise<number> {
  if (!_db) return 0
  const snap = await getDocs(collection(_db, 'stock_entries'))
  if (snap.empty) return 0
  let deleted = 0
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(_db)
    docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref))
    await batch.commit()
    deleted += docs.slice(i, i + 500).length
  }
  return deleted
}
