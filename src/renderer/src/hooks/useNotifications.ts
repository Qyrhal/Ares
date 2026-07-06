import { useEffect, useCallback } from 'react'

export function useNotifications() {
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const notify = useCallback((title: string, body?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon.png' })
    }
  }, [])

  useEffect(() => { requestPermission() }, [requestPermission])

  return { notify, requestPermission }
}
