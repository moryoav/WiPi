// src/hooks/usePis.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import TcpSocket from 'react-native-tcp-socket';
import { loadPis } from '../lib/storage';

export function usePis(pollIntervalMs = 3000) {
  const [pis, setPis] = useState([]);
  const [reachable, setReachable] = useState({});
  const appState = useRef(AppState.currentState);
  const timerRef = useRef(null);

  /* ---------- Load / refresh Pi list ---------- */
  const refresh = useCallback(async () => {
    const list = await loadPis();
    setPis(list);
  }, []);

  useEffect(() => {
    refresh(); // first load
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  /* ---------- Probe reachability ---------- */
  const probeReachability = useCallback(() => {
    pis.forEach(pi => {
      let connected = false;
      const socket = TcpSocket.createConnection(
        { host: pi.host, port: 22, timeout: 2000 },
        () => {
          connected = true;
          socket.destroy();
          setReachable(prev => ({ ...prev, [pi.id]: true }));
        }
      );

      const markDown = () => {
        if (connected) return;
        socket.destroy();
        setReachable(prev => ({ ...prev, [pi.id]: false }));
      };

      socket.on('error', markDown);
      socket.on('timeout', markDown);
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

    const onAppStateChange = next => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        start();
      } else if (next.match(/inactive|background/)) {
        stop();
      }
      appState.current = next;
    };

    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      stop();
      sub.remove();
    };
  }, [probeReachability, pollIntervalMs]);

  return { pis, reachable, refresh };
}