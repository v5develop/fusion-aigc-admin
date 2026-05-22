import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useWatermarkStore = defineStore('watermark', () => {
  const enabled = ref(false)
  const content = ref('')

  const watermarkProps = computed(() => {
    if (!enabled.value || !content.value) {
      return { content: '' }
    }
    return {
      content: content.value,
      font: { fontSize: 14, color: 'rgba(0, 0, 0, 0.08)' },
      gap: [100, 100] as [number, number],
      rotate: -22,
    }
  })

  function setWatermark(text: string) {
    content.value = text
    enabled.value = true
  }

  function clearWatermark() {
    content.value = ''
    enabled.value = false
  }

  return { enabled, content, watermarkProps, setWatermark, clearWatermark }
})
