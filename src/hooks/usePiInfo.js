// src/hooks/usePiInfo.js
import { useState, useEffect, useCallback } from 'react';
import { getPiCreds } from '../lib/storage';
import { runSSH } from '../lib/sshClient';

export function usePiInfo(piId, host) {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAps, setLoadingAps] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [error, setError] = useState(null);
  const [leases, setLeases] = useState([]);
  const [aps, setAps] = useState([]);
  const [devices, setDevices] = useState([]);
  const [debugLogs, setDebugLogs] = useState([]);

  const log = useCallback(msg => {
    setDebugLogs(dl => [...dl, msg]);
  }, []);

  // 1️⃣ Load SSH creds
  useEffect(() => {
    (async () => {
      log('🔑 Loading SSH credentials…');
      try {
        const c = await getPiCreds(piId);
        log('✔️  Creds loaded');
        setCreds({ host, ...c });
      } catch (e) {
        log(`❌ Error loading creds: ${e.message}`);
        setError(e);
        setLoading(false);
      }
    })();
  }, [piId, host, log]);

  // 2️⃣ SSH helper
  const runCmd = useCallback(
    async cmd => {
      if (!creds) throw new Error('SSH credentials not ready');
      log(`➡️ ${cmd}`);
      const safe = cmd.replace(/"/g, '\\"');
      const out = await runSSH({
        ...creds,
        command: `bash -lc "${safe}"`,
      });
      log(`📥 ${out.replace(/\n/g, '\\n')}`);
      return out;
    },
    [creds, log]
  );

  // 3️⃣ Gather everything
  useEffect(() => {
    if (!creds) return;

    (async () => {
      setLoading(true);
      setLoadingAps(true);
      setLoadingDevices(false);
      log('🚀 Starting fetch…');

      try {
        const iw = '/usr/sbin/iw';

        // interfaces
        const listOut = await runCmd(
          `${iw} dev | awk '/Interface/ {print $2}' 2>&1`
        );
        const rawIfaces = listOut.split('\n').filter(Boolean);
        const ifaces = rawIfaces.map(l => l.trim().replace(/^Interface\s+/i, ''));
        log(`👀 Interfaces: ${JSON.stringify(ifaces)}`);

        // leases
        const leasesOut = await runCmd(
          'cat /var/lib/misc/dnsmasq.leases 2>&1'
        );
        const leaseLines = leasesOut.split('\n').filter(Boolean);
        const parsedLeases = leaseLines.map(line => {
          const parts = line.split(/\s+/);
          return { mac: parts[1], hostname: parts[3] || '' };
        });
        log(`🏷️ Leases: ${JSON.stringify(parsedLeases)}`);
        setLeases(parsedLeases);

        // gather AP info
        const apList = [];
        const infoMap = {};
        const stMap = {};

        for (const iface of ifaces) {
          const infoText = await runCmd(
            `${iw} dev ${iface} info 2>&1`
          );
          infoMap[iface] = infoText;

          if (infoText.includes('type AP')) {
            apList.push(iface);
            const stText = await runCmd(
              `${iw} dev ${iface} station dump 2>&1`
            );
            stMap[iface] = stText;
          }
        }

        // parse APs
        const parsedAps = apList.map(iface => {
          const info = infoMap[iface] || '';
          const ssidM = info.match(/^\s*ssid\s+(.+)$/m);
          const chanM = info.match(/channel\s+(\d+)/);
          return {
            iface,
            ssid: ssidM ? ssidM[1] : '',
            channel: chanM ? chanM[1] : '',
          };
        });
        log(`📦 APs: ${JSON.stringify(parsedAps)}`);
        setAps(parsedAps);
        setLoadingAps(false);

        // 4️⃣ devices
        setLoadingDevices(true);
        const parsedDevices = [];
        for (const iface of apList) {
          const text = (stMap[iface] || '').trim();
          const blocks = text
            .split(/\nStation /)
            .map((b, i) => (i === 0 ? b : 'Station ' + b));

          for (const b of blocks) {
            const macM = b.match(/^Station\s+([0-9A-F:]+)/i);
            if (!macM) continue;
            const ackM = b.match(/last ack signal:\s*([-\d]+)/i);
            const conM = b.match(/connected time:\s*(\d+)/i);
            const mac = macM[1];
            const lease = parsedLeases.find(
              l => l.mac.toLowerCase() === mac.toLowerCase()
            );
            parsedDevices.push({
              iface,
              mac,
              hostname: lease?.hostname || '',
              lastAck: ackM ? `${ackM[1]} dBm` : '',
              connectedSeconds: conM ? parseInt(conM[1], 10) : null,
            });
          }
        }
        log(`📦 Devices: ${JSON.stringify(parsedDevices)}`);
        setDevices(parsedDevices);
        setLoadingDevices(false);
      } catch (e) {
        log(`❌ Fetch error: ${e.message}`);
        setError(e);
      } finally {
        log('🏁 Fetch complete.');
        setLoading(false);
      }
    })();
  }, [creds, runCmd, log]);

  return {
    loading,
    loadingAps,
    loadingDevices,
    error,
    leases,
    aps,
    devices,
    debugLogs,
  };
}
