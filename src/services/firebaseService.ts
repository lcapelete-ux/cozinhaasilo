import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import type { Order, OrderStatus, MenuItem, InventoryItem, ExtraFicha, User } from '../types'

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
    cleaned = String(parseInt(numericMatch[0], 10))
  }

  if (_db) {
    const q = query(collection(_db, 'extra_fichas'), where('qr_code', '==', raw.trim()))
    const snap = await getDocs(q)
    if (!snap.empty) {
      return snap.docs[0].data().alias as string
    }
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
  const q = query(
    collection(_db, 'orders'),
    where('status', 'in', statuses),
    orderBy('created_at', 'asc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>)))
  })
}

export function subscribeAllOrders(callback: (orders: Order[]) => void) {
  if (!_db) return () => {}
  const q = query(collection(_db, 'orders'), orderBy('created_at', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>)))
  })
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

export async function getOrderByTicket(ticket: string): Promise<Order | null> {
  if (!_db) return null
  const q = query(collection(_db, 'orders'), where('ticket_number', '==', ticket))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return mapOrder(d.id, d.data() as Record<string, unknown>)
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
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, 'id'>) })))
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
    { name: 'admin', password: 'admin123', role: 'admin', allowed_views: 'reception,kitchen,kitchen-scanner,kitchen-sectors,display,dispatch,history,inventory,extra-fichas,admin-dashboard,admin' },
    { name: 'cozinha', password: 'cozinha123', role: 'kitchen', allowed_views: 'kitchen,kitchen-scanner,kitchen-sectors,display' },
    { name: 'recepcao', password: 'recepcao123', role: 'reception', allowed_views: 'reception,display' },
    { name: 'entrega', password: 'entrega123', role: 'dispatch', allowed_views: 'dispatch,display,history' },
  ]
  for (const u of usersData) await addDoc(collection(_db, 'users'), u)

  const menuData: Omit<MenuItem, 'id'>[] = [
    { name: 'Coxinha', price: 5.0, sector: 'Fritadeira', category: 'Salgados' },
    { name: 'Pastel de Carne', price: 5.0, sector: 'Fritadeira', category: 'Salgados' },
    { name: 'Pastel de Queijo', price: 5.0, sector: 'Fritadeira', category: 'Salgados' },
    { name: 'Rissole', price: 5.0, sector: 'Fritadeira', category: 'Salgados' },
    { name: 'Hambúrguer', price: 12.0, sector: 'Lanches', category: 'Lanches' },
    { name: 'X-Salada', price: 14.0, sector: 'Lanches', category: 'Lanches' },
    { name: 'Hot Dog', price: 10.0, sector: 'Lanches', category: 'Lanches' },
    { name: 'Milho Verde', price: 6.0, sector: 'Outros', category: 'Outros' },
    { name: 'Pamonha', price: 7.0, sector: 'Outros', category: 'Outros' },
    { name: 'Canjica', price: 6.0, sector: 'Outros', category: 'Outros' },
    { name: 'Quentão', price: 5.0, sector: 'Outros', category: 'Bebidas' },
    { name: 'Refrigerante', price: 4.0, sector: 'Outros', category: 'Bebidas' },
  ]
  for (const m of menuData) await addDoc(collection(_db, 'menu_items'), m)

  const inventoryData: Omit<InventoryItem, 'id'>[] = [
    { name: 'Farinha de trigo', quantity: 10, unit: 'kg' },
    { name: 'Óleo de soja', quantity: 20, unit: 'L' },
    { name: 'Pão de hambúrguer', quantity: 100, unit: 'un' },
    { name: 'Refrigerante lata', quantity: 200, unit: 'un' },
    { name: 'Milho verde', quantity: 50, unit: 'un' },
  ]
  for (const inv of inventoryData) await addDoc(collection(_db, 'inventory'), inv)
}
