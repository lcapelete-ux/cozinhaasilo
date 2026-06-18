// Runs on a GitHub Actions schedule (see .github/workflows/stock-alert.yml).
// Reads menu_items via firebase-admin (server-side, no client quota impact)
// and sends a Web Push notification to every subscribed device when an item
// crosses the low-stock threshold. No Firebase Cloud Functions involved.
import admin from 'firebase-admin'
import webpush from 'web-push'

const LOW_STOCK_THRESHOLD = 15

const required = ['FIREBASE_SERVICE_ACCOUNT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

webpush.setVapidDetails(
  'mailto:no-reply@cozinhaasilo.local',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

async function main() {
  const menuSnap = await db.collection('menu_items').get()
  const lowItems = []

  const batch = db.batch()
  let batchHasWrites = false

  for (const docSnap of menuSnap.docs) {
    const item = docSnap.data()
    if (!(item.stock_initial > 0)) continue
    const stock = item.stock ?? 0
    const isLow = stock <= LOW_STOCK_THRESHOLD
    const wasNotified = item.low_stock_notified === true

    if (isLow && !wasNotified) {
      lowItems.push({ name: item.name, stock })
      batch.update(docSnap.ref, { low_stock_notified: true })
      batchHasWrites = true
    } else if (!isLow && wasNotified) {
      batch.update(docSnap.ref, { low_stock_notified: false })
      batchHasWrites = true
    }
  }

  if (batchHasWrites) await batch.commit()

  if (lowItems.length === 0) {
    console.log('No new low-stock items to notify.')
    return
  }

  const title = lowItems.length === 1 ? 'Estoque baixo' : `${lowItems.length} itens com estoque baixo`
  const body = lowItems
    .map((i) => `${i.name}: ${i.stock === 0 ? 'ZERADO' : `${i.stock} un.`}`)
    .join(' · ')
  const payload = JSON.stringify({ title, body })

  const subsSnap = await db.collection('push_subscriptions').get()
  if (subsSnap.empty) {
    console.log(`${lowItems.length} item(s) low, but no devices subscribed.`)
    return
  }

  await Promise.all(
    subsSnap.docs.map(async (subDoc) => {
      const sub = subDoc.data()
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      } catch (err) {
        console.error(`Push failed for ${subDoc.id}:`, err.statusCode || err.message)
        if (err.statusCode === 404 || err.statusCode === 410) {
          await subDoc.ref.delete()
        }
      }
    })
  )

  console.log(`Notified ${subsSnap.size} device(s) about: ${lowItems.map((i) => i.name).join(', ')}`)
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
