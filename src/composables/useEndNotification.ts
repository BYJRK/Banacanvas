import { ref, watch } from 'vue'
import { useI18n } from './useI18n'

const NOTIFY_ON_END_KEY = 'banacanvas-notify-on-end'

/** Optional browser notification when a generation finishes. */
export function useEndNotification() {
  const { t } = useI18n()
  const notifyOnEnd = ref(localStorage.getItem(NOTIFY_ON_END_KEY) === 'true')

  watch(notifyOnEnd, (val) => {
    localStorage.setItem(NOTIFY_ON_END_KEY, String(val))
    if (val && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  })

  function notify(success: boolean) {
    if (!notifyOnEnd.value || Notification.permission !== 'granted') return
    new Notification(success ? t('notificationSuccess') : t('notificationError'))
  }

  return { notifyOnEnd, notify }
}
