// src/hooks/usePiTrafficStats.js

import { useState, useEffect, useCallback } from 'react';
import { getPiCreds } from '../lib/storage';
import { runSSH } from '../lib/sshClient';

/**
 * Hook to fetch vnStat network traffic statistics (daily, monthly, hourly)
 * for the Pi's outbound network interface, which is auto-detected via default route.
 * Uses JSON output for easier parsing and logs to the console for debugging.
 *
 * @param {string} piId    - Identifier for the Pi (used to load stored credentials)
 * @param {string} host    - SSH host address for the Pi
 * @returns {{
 *   loading: boolean,
 *   iface: string | null,
 *   dailyStats: object | null,
 *   monthlyStats: object | null,
 *   hourlyStats: object | null,
 *   error: Error | null,
 *   debugLogs: string[]
 * }}
 */
export function usePiTrafficStats(piId, host) {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [iface, setIface] = useState(null);
  const [dailyStats, setDailyStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [hourlyStats, setHourlyStats] = useState(null);
  const [error, setError] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

  // Helper to append to both in-memory log and console
  const log = useCallback(msg => {
    setDebugLogs(dl => [...dl, msg]);
    //console.log('[usePiTrafficStats]', msg);
  }, []);

  // 1️⃣ Load SSH credentials
  useEffect(() => {
    (async () => {
      log('🔑 Loading SSH credentials…');
      try {
        const c = await getPiCreds(piId);
        log('✔️ Creds loaded');
        //console.log('Credentials:', c);
        setCreds({ host, ...c });
      } catch (e) {
        log(`❌ Error loading creds: ${e.message}`);
        console.error(e);
        setError(e);
        setLoading(false);
      }
    })();
  }, [piId, host, log]);

  // 2️⃣ SSH command runner
  const runCmd = useCallback(
    async cmd => {
      if (!creds) throw new Error('SSH credentials not ready');
      log(`➡️ ${cmd}`);
      //console.log('Running command:', cmd);
      const safe = cmd.replace(/"/g, '\\"');
      const out = await runSSH({
        ...creds,
        command: `bash -lc "${safe}"`,
      });
      log(`📥 raw output length: ${out.length}`);
      //console.log('Raw output:', out);
      return out;
    },
    [creds, log]
  );

  // 3️⃣ Detect interface & fetch vnStat JSON data
  useEffect(() => {
    if (!creds) return;
    (async () => {
      setLoading(true);
      try {
        // detect default outbound interface by parsing "ip route show default"
        log('🔍 Detecting default network interface…');
        const routeOut = await runCmd('ip route show default');
        const parts = routeOut.trim().split(/\s+/);
        const devIndex = parts.indexOf('dev');
        if (devIndex === -1 || devIndex + 1 >= parts.length) {
          throw new Error('Could not parse interface from route output');
        }
        const detected = parts[devIndex + 1];
        log(`🛣️ Default interface detected: ${detected}`);
        setIface(detected);

        // fetch vnStat daily JSON
        log(`🚦 Fetching daily JSON for ${detected}`);
        const dailyRaw = await runCmd(`vnstat -d -i ${detected} --json`);
        //console.log('Daily JSON raw:', dailyRaw);
        const dailyJson = JSON.parse(dailyRaw);
        //console.log('Daily parsed:', dailyJson);
        setDailyStats(dailyJson);

        // fetch vnStat monthly JSON
        log(`🚦 Fetching monthly JSON for ${detected}`);
        const monthlyRaw = await runCmd(`vnstat -m -i ${detected} --json`);
        //console.log('Monthly JSON raw:', monthlyRaw);
        const monthlyJson = JSON.parse(monthlyRaw);
        //console.log('Monthly parsed:', monthlyJson);
        setMonthlyStats(monthlyJson);

        // fetch vnStat hourly JSON
        log(`🚦 Fetching hourly JSON for ${detected}`);
        const hourlyRaw = await runCmd(`vnstat -h -i ${detected} --json`);
        //console.log('Hourly JSON raw:', hourlyRaw);
        const hourlyJson = JSON.parse(hourlyRaw);
        //console.log('Hourly parsed:', hourlyJson);
        setHourlyStats(hourlyJson);

        log('✅ vnStat JSON data fetched');
      } catch (e) {
        log(`❌ vnStat fetch/parsing error: ${e.message}`);
        console.error(e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [creds, runCmd, log]);

  return {
    loading,
    iface,
    dailyStats,
    monthlyStats,
    hourlyStats,
    error,
    debugLogs,
  };
}
