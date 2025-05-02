// src/hooks/useNetworks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { runSSH } from '../lib/sshClient';
import { getPiCreds } from '../lib/storage';

/* ───────── helpers ──────── */
function parseStatus(text = '') {
  const obj = {};
  text.split('\n').forEach((line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  });
  return obj;
}

function parseNetworks(text = '') {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(/\s+/);
    const [id = '', ssid = ''] = cols;
    const flags = cols.slice(3).join(' ');
    return {
      id: id.trim(),
      ssid: ssid.trim(),
      selected: flags.includes('CURRENT'),
    };
  });
}

/* ───────── main hook ───────── */
export function useNetworks(piId, host) {
  /* --- state --- */
  const [creds, setCreds]       = useState(null);
  const [iface, setIface]       = useState(null);
  const [curr, setCurr]         = useState(null);
  const [known, setKnown]       = useState([]);
  const [scan, setScan]         = useState([]);
  const [scanning, setScanning] = useState(false);

  const [initialScanDone, setInitialScanDone] = useState(false); // ★ ADDED
  const initialLoadStarted = useRef(false);                       // ★ ADDED

  const knownRef = useRef([]);

  /* keep latest known list in a ref */
  useEffect(() => { knownRef.current = known; }, [known]);

  /* 1) Load SSH credentials and detect client interface */
  useEffect(() => {
    (async () => {
      try {
        const c = await getPiCreds(piId);
        setCreds({ host, ...c });

        const out = await runSSH({
          host,
          ...c,
          command: `bash -lc "iw dev | awk '/Interface/ {print $2}'"`
        });

        const chosen = (out.trim().split('\n')[0] || '')
                         .replace(/^Interface\s+/i, '').trim();
        setIface(chosen);
      } catch (err) {
        console.warn('Failed to load creds or detect iface:', err);
      }
    })();
  }, [piId, host]);

  /* 2) Utility: run multiple commands in one SSH session */
  const runPipeline = useCallback(
    async (cmds) => {
      if (!creds) throw new Error('SSH credentials not ready');
      const pipeline = cmds.join(' && ');
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await runSSH({ ...creds, command: `bash -lc "${pipeline}"` });
        } catch (err) {
          if (attempt === 1 && /Connection reset/.test(err.message)) {
            await new Promise((r) => setTimeout(r, 3000));
            continue;                       // retry once
          }
          throw err;
        }
      }
    },
    [creds]
  );

  /* 3) Refresh "current" + "known" */
  const refresh = useCallback(async () => {
    if (!creds || !iface) return;
    try {
      const out = await runPipeline([
        `/sbin/wpa_cli -i ${iface} status`,
        'echo "__SPLIT__"',
        `/sbin/wpa_cli -i ${iface} list_networks`,
      ]);
      const [statusTxt, netsTxt] = out.split('__SPLIT__');
      setCurr(parseStatus(statusTxt));
      setKnown(parseNetworks(netsTxt));
    } catch (err) {
      console.warn('refresh error:', err);
      setCurr(null);
      setKnown([]);
    }
  }, [creds, iface, runPipeline]);

  /* 4) Scan for ALL networks (adds RSSI & creates "scan" list) */
  const scanNetworks = useCallback(async () => {
    if (!creds || !iface || scanning) return;

    setScanning(true);
    const timeoutId = setTimeout(() => setScanning(false), 10000); // safety

    try {
      const scanOut = await runPipeline([
        `/sbin/wpa_cli -i ${iface} scan`,
        'sleep 2',
        `/sbin/wpa_cli -i ${iface} scan_results`,
      ]);
      const lines = scanOut.trim().split('\n').slice(1);

      /* SSID → best signal map */
      const bySsid = new Map();
      lines.forEach((line) => {
        const cols = line.split('\t');
        const ssid   = (cols[4] || '').trim();
        const signal = parseInt(cols[2], 10);
        if (!ssid) return;
        const key = ssid.toLowerCase();
        const prev = bySsid.get(key);
        if (!prev || signal > prev.signal) bySsid.set(key, { ssid, signal });
      });

      /* filter out networks we already know */
      const knownSsids = new Set(knownRef.current.map(n => n.ssid.toLowerCase()));
      const filtered   = Array.from(bySsid.values())
                              .filter(n => !knownSsids.has(n.ssid.toLowerCase()))
                              .sort((a,b) => b.signal - a.signal);

      /* update state */
      setScan(filtered);
      setKnown(prev => prev.map(n => ({
        ...n,
        signal: bySsid.get(n.ssid.toLowerCase())?.signal,
      })));

      if (!initialScanDone) setInitialScanDone(true);           // ★ ADDED
    } catch (err) {
      console.warn('scanNetworks error:', err);
    } finally {
      clearTimeout(timeoutId);
      setScanning(false);
    }
  }, [creds, iface, scanning, runPipeline, initialScanDone]);

  /* 5) Bootstrap – run ONCE when creds + iface ready */
  useEffect(() => {
    if (!creds || !iface || initialLoadStarted.current) return; // ★ ADDED guard
    initialLoadStarted.current = true;                          // ★ ADDED

    (async () => {
      await refresh();      // current + known
      await scanNetworks(); // nearby
    })();
  }, [creds, iface, refresh, scanNetworks]);

  /* 6) Connect / forget / connect-new helpers */
  const connect = useCallback(async (id) => {
    if (!creds || !iface) return;
    await runPipeline([`/sbin/wpa_cli -i ${iface} select_network ${id}`]);
    await new Promise(r => setTimeout(r, 3000));
    await refresh();
    await scanNetworks();
  }, [creds, iface, runPipeline, refresh, scanNetworks]);

  const forget = useCallback(async (id) => {
    if (!creds || !iface) return;
    await runPipeline([
      `/sbin/wpa_cli -i ${iface} remove_network ${id}`,
      `/sbin/wpa_cli -i ${iface} save_config`,
    ]);
    refresh();
  }, [creds, iface, runPipeline, refresh]);

  const connectNew = useCallback(async (ssid, psk='') => {
    if (!creds || !iface) return;
    try {
      const netId = (await runSSH({
        ...creds,
        command: `/sbin/wpa_cli -i ${iface} add_network`,
      })).trim();

      const cmds = [
        `/sbin/wpa_cli -i ${iface} set_network ${netId} ssid '"${ssid}"'`,
        psk
          ? `/sbin/wpa_cli -i ${iface} set_network ${netId} psk '"${psk}"'`
          : `/sbin/wpa_cli -i ${iface} set_network ${netId} key_mgmt NONE`,
        `/sbin/wpa_cli -i ${iface} enable_network ${netId}`,
        `/sbin/wpa_cli -i ${iface} select_network ${netId}`,
        `/sbin/wpa_cli -i ${iface} save_config`,
      ];
      await runPipeline(cmds);
    } catch (err) {
      console.warn('connectNew error:', err);
    } finally {
      setTimeout(refresh, 1000);
      setScan([]);
    }
  }, [creds, iface, runPipeline, refresh]);

  /* 7) Public API */
  const initialLoading = !initialScanDone; // true until first scan finishes  // ★ ADDED

  return {
    /* flags */
    initialLoading,  // ★ ADDED
    scanning,

    /* data */
    creds,
    curr,
    known,
    scan,

    /* actions */
    refresh,
    scanNetworks,
    connect,
    forget,
    connectNew,
  };
}
