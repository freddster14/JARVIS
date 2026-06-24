import { useState, useEffect } from 'react';
import { subscribeToPush, unsubscribeFromPush, getSubscriptionStatus } from '../lib/push.js';

export function usePushSubscription() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubscriptionStatus().then(setSubscribed);
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      await subscribeToPush();
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  return { subscribed, loading, enable, disable };
}
