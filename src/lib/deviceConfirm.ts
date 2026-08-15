/**
 * Cross-tab signal that a device-confirmation link was opened.
 * The confirm tab (DeviceConfirm page) broadcasts; the login/operate overlay
 * listens and completes the sign-in immediately instead of only polling.
 */
const CHANNEL = "phantix_device_confirm";

export function notifyDeviceConfirmed(): void {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage("confirmed");
    bc.close();
  } catch {
    /* BroadcastChannel unavailable — fall through to storage events */
  }
  try {
    localStorage.setItem(CHANNEL, String(Date.now()));
    window.dispatchEvent(new CustomEvent(CHANNEL));
  } catch {
    /* storage blocked — polling remains the fallback */
  }
}

export function listenDeviceConfirmed(onDone: () => void): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => onDone();
  } catch {
    /* BroadcastChannel unavailable */
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHANNEL) onDone();
  };
  const onLocal = () => onDone();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANNEL, onLocal);
  return () => {
    if (bc) bc.close();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANNEL, onLocal);
  };
}
