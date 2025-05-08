// src/hooks/usePis.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { loadPis } from '../lib/storage';

// Timeout for dashboard reachability check (in milliseconds)
const DASHBOARD_TIMEOUT = 3000;

/**
 * Performs a simple HTTP GET to the Pi's RaspAP admin dashboard on port 80
 * and returns true if the response is in the 2xx range.
 */
async function checkDashboard(host) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_TIMEOUT);

    const response = await fetch(`http://${host}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Hook to load the user's Pis and periodically probe their reachability
 * via HTTP checks against the RaspAP dashboard on port 80.
 */
export function usePis(pollIntervalMs = 3000) {
  const [pis, setPis] = useState([]);
  const [reachable, setReachable] = useState({});
  const appState = useRef(AppState.currentState);
  const timerRef = useRef(null);

  /* ---------- Load / refresh Pi list ---------- */
  /* ---------- Load / refresh Pi list + reachability ---------- */
  const refresh = useCallback(async () => {
    // ① reload the list stored on the device
    const list = await loadPis();
    setPis(list);

    // ② probe each Pi right away so UI updates instantly
    const results = await Promise.all(
      list.map(async (pi) => {
        const ok = await checkDashboard(pi.host);
        return { id: pi.id, ok };
      })
    );
    setReachable((prev) => {
      const next = { ...prev };
      results.forEach(({ id, ok }) => {
        next[id] = ok;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    refresh(); // initial load
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  /* ---------- Probe reachability via HTTP ---------- */
  const probeReachability = useCallback(async () => {
    const results = await Promise.all(
      pis.map(async (pi) => {
        const ok = await checkDashboard(pi.host);
        return { id: pi.id, ok };
      })
    );

    setReachable(prev => {
      const next = { ...prev };
      results.forEach(({ id, ok }) => {
        next[id] = ok;
      });
      return next;
    });
  }, [pis]);

  /* ---------- Timer & AppState management ---------- */
  useEffect(() => {
    const start = () => {
      probeReachability();
      timerRef.current = setInterval(probeReachability, pollIntervalMs);
    };
    const stop = () => timerRef.current && clearInterval(timerRef.current);

    start();

    const onAppStateChange = nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        start();
      } else if (nextState.match(/inactive|background/)) {
        stop();
      }
      appState.current = nextState;
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      stop();
      subscription.remove();
    };
  }, [probeReachability, pollIntervalMs]);

  return { pis, reachable, refresh };
}
