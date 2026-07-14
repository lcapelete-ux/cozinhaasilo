import { useCallback, useEffect, useState } from 'react'
import { savePushSubscription, deletePushSubscription } from '../services/firebaseService'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
}

export function usePushNotifications() {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) return false
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false
      // O service worker é registrado automaticamente pelo vite-plugin-pwa;
      // aqui só aguardamos ele ficar pronto para assinar o push.
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await savePushSubscription(sub.toJSON())
      setSubscribed(true)
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await deletePushSubscription(sub.endpoint)
      await sub.unsubscribe()
    }
    setSubscribed(false)
  }, [])

  return { subscribed, loading, subscribe, unsubscribe, supported: isPushSupported() }
}
