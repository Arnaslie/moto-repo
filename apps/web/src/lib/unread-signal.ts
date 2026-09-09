export const UNREAD_CHANGED = "moto:unread-changed";

export function announceUnreadChanged() {
  window.dispatchEvent(new Event(UNREAD_CHANGED));
}

export function onUnreadChanged(handler: () => void): () => void {
  window.addEventListener(UNREAD_CHANGED, handler);
  return () => window.removeEventListener(UNREAD_CHANGED, handler);
}
