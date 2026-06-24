import webpush from 'web-push';

export function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? 'admin@jarvis.local';

  if (!publicKey || !privateKey) {
    console.warn(
      '[VAPID] Keys not set — push notifications disabled. Run: npx web-push generate-vapid-keys'
    );
    return;
  }

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? '';
}
