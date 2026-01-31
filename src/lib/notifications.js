/**
 * Browser notifications for processing complete and items needing review.
 * Requests permission on first use; only shows when permission is granted.
 */

const DEFAULT_TITLE = "CORTEX";

/**
 * Check if the Notification API is available (and we're in a secure context).
 */
export function isSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current permission state (without prompting).
 */
export function getPermission() {
  if (!isSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission. Resolves to true if granted, false otherwise.
 */
export async function requestPermission() {
  if (!isSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a browser notification. No-op if permission not granted or unsupported.
 */
export function showNotification(title, options = {}) {
  if (!isSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      icon: "/stewart-logo.png",
      badge: "/stewart-logo.png",
      tag: options.tag ?? "cortex",
      requireInteraction: false,
      ...options,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    // Auto-close after 8 seconds if not requireInteraction
    if (!options.requireInteraction) {
      setTimeout(() => n.close(), 8000);
    }
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

/**
 * Notify when processing has just completed.
 * @param {{ completed: number, needsReview: number, failed: number }} stats
 */
export function showProcessingComplete(stats) {
  const { completed = 0, needsReview = 0, failed = 0 } = stats || {};
  const parts = [];
  if (completed > 0) parts.push(`${completed} completed`);
  if (needsReview > 0) parts.push(`${needsReview} need review`);
  if (failed > 0) parts.push(`${failed} failed`);
  const body = parts.length ? parts.join(", ") : "Processing finished.";
  showNotification(DEFAULT_TITLE, {
    body: `Processing complete. ${body}`,
    tag: "processing-complete",
  });
}

/**
 * Notify that there are documents waiting for review (e.g. when user returns to tab).
 */
export function showNeedsReview(count) {
  showNotification(DEFAULT_TITLE, {
    body: `${count} document${count !== 1 ? "s" : ""} need your review.`,
    tag: "needs-review",
  });
}

export default {
  isSupported,
  getPermission,
  requestPermission,
  showNotification,
  showProcessingComplete,
  showNeedsReview,
};
