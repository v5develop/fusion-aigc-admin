import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { Notification } from '@/types/layout'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])

  const unreadCount = computed(() =>
    notifications.value.filter((n) => !n.read).length,
  )

  function addNotification(notification: Notification) {
    notifications.value.unshift(notification)
  }

  function markAsRead(id: string) {
    const item = notifications.value.find((n) => n.id === id)
    if (item) {
      item.read = true
    }
  }

  function markAllAsRead() {
    notifications.value.forEach((n) => {
      n.read = true
    })
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function clearAll() {
    notifications.value = []
  }

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  }
})
