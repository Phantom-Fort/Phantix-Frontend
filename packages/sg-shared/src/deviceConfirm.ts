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

/**
 * One exchange per confirmation link.
 *
 * The confirm tab signals the waiting tab over BroadcastChannel *and* a
 * storage write, and the waiting tab also polls on a timer and re-checks when
 * it regains focus — so `/auth/device-status` gets fired several times within
 * a few milliseconds of the link being opened. Every exchange that succeeds
 * mints a session and revokes the previous one bound to this device, so the
 * duplicate call handed the tab tokens for a session that had already been
 * revoked: signed in, then signed straight back out. The backend now refuses
 * the second exchange; this keeps the tab from attempting it, and hands every
 * concurrent caller the one request whose result the tab actually keeps.
 */
export type ExchangeGuard<T> = { challenge: string; inFlight: Promise<T> | null; result?: T };

export function newExchangeGuard<T>(): ExchangeGuard<T> {
  return { challenge: "", inFlight: null };
}

/** Run `exchange` once per `challenge`; concurrent callers share the attempt. */
export function claimExchange<T>(
  guard: ExchangeGuard<T>,
  challenge: string,
  exchange: () => Promise<T>,
  succeeded: (result: T) => boolean,
): Promise<T> {
  if (guard.challenge !== challenge) {
    guard.challenge = challenge;
    guard.inFlight = null;
    guard.result = undefined;
  }
  if (guard.result !== undefined) return Promise.resolve(guard.result);
  if (guard.inFlight) return guard.inFlight;
  const attempt = exchange().then(
    (result) => {
      guard.inFlight = null;
      if (succeeded(result)) guard.result = result;
      return result;
    },
    (err) => {
      guard.inFlight = null;
      throw err;
    },
  );
  guard.inFlight = attempt;
  return attempt;
}
