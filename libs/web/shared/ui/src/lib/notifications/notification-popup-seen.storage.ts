const STORAGE_PREFIX = 'notary-portal.notification-popup-seen.';

export function readSeenPopupNotificationIds(userId: string): Set<string> {
  if (!userId) {
    return new Set();
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function markPopupNotificationSeen(userId: string, notificationId: string): void {
  if (!userId || !notificationId) {
    return;
  }

  const seen = readSeenPopupNotificationIds(userId);
  if (seen.has(notificationId)) {
    return;
  }

  seen.add(notificationId);
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify([...seen]));
}
