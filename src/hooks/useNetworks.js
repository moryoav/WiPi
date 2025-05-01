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

/* ───────── hook ─────────── */
export function useNetworks(piId, host) {
  const [creds, setCreds]       = useState(null);
  const [iface, setIface]       = useState(null);
  const [curr, setCurr]         = useState(null);
  const [known, setKnown]       = useState([]);
  const [scan, setScan]         = useState([]);
  const [scanning, setScanning] = useState(false);
  const [initialScanDone, setInitialScanDone] = useState(false);
  const knownRef = useRef([]);  // Add ref to track known networks

  // Update ref when known changes
  useEffect(() => {
    knownRef.current = known;
  }, [known]);

  /* 1) Load SSH credentials once */
  useEffect(() => {
    (async () => {
      try {
        const c = await getPiCreds(piId);
        setCreds({ host, ...c });
        // as soon as creds are set, detect the client interface:
        const out = await runSSH({
          host: host,
          ...c,
          command: `bash -lc "iw dev | awk '/Interface/ {print $2}'"`
        });
		const all = out.trim().split('\n').filter(Boolean);
		let chosen = all[0] || '';
		// if it still has "Interface " in front, remove it:
		chosen = chosen.replace(/^Interface\s+/i, '').trim();

		setIface(chosen);
		console.log('🔍 Detected client interface:', chosen);		
      } catch (err) {
        console.warn('Failed to load creds:', err);
      }
    })();
  }, [piId, host]);

  // Do initial scan when both creds and iface are ready
  useEffect(() => {
    if (!creds || !iface || initialScanDone) return;

    console.log('Credentials and interface ready, waiting 3 seconds before initial scan...');
    const timer = setTimeout(async () => {
      console.log('Starting initial scan...');
      await refresh();
      await scanNetworks();
      setInitialScanDone(true);
    }, 3000);

    return () => {
      console.log('Cleaning up initial scan timer...');
      clearTimeout(timer);
    };
  }, [creds, iface, initialScanDone, refresh, scanNetworks]);

  /* 2) Run multiple commands in one session */
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
            continue;
          }
          throw err;
        }
      }
    },
    [creds]
  );

  /* 3) Refresh current + known (no signal info here) */
	const refresh = useCallback(async () => {
	  if (!creds || !iface) return;               // ← also guard on iface
	  try {
		const out = await runPipeline([
		  `/sbin/wpa_cli -i ${iface} status`,      // ← use ${iface}
		  'echo "__SPLIT__"',
		  `/sbin/wpa_cli -i ${iface} list_networks`, // ← and here
		]);
		const [statusTxt, netsTxt] = out.split('__SPLIT__');
		setCurr(parseStatus(statusTxt));
		setKnown(parseNetworks(netsTxt));
	  } catch (err) {
		console.warn('refresh error:', err);
		setCurr(null);
		setKnown([]);
	  }
	}, [creds, iface, runPipeline]);               // ← add iface to deps

  /* 4) Scan for *all* networks & merge RSSI into known */
	const scanNetworks = useCallback(async () => {
	  console.log('scanNetworks called - creds:', !!creds, 'iface:', iface, 'scanning:', scanning);
	  
	  // don't start until both creds and iface are known
	  if (!creds || !iface) {
	    console.log('scanNetworks aborted - missing:', !creds ? 'creds' : 'iface');
	    return;
	  }
	  
	  // Prevent multiple simultaneous scans
	  if (scanning) {
	    console.log('scanNetworks aborted - already scanning');
	    return;
	  }
	  
	  setScanning(true);
	  console.log('Starting network scan...');
	  
	  // Add a safety timeout to prevent scanning state from getting stuck
	  const timeoutId = setTimeout(() => {
	    console.log('Scan timeout reached - resetting scanning state');
	    setScanning(false);
	  }, 10000); // 10 second timeout

	  try {
		// trigger scan on the dynamic interface…
		console.log('Running scan commands...');
		const scanOut = await runPipeline([
		  `/sbin/wpa_cli -i ${iface} scan`,
		  'sleep 2',
		  `/sbin/wpa_cli -i ${iface} scan_results`,
		]);
		console.log('Scan commands completed, processing results...');
		const lines = scanOut.trim().split('\n').slice(1);

		// build SSID→signal map
		const bySsid = new Map();
		lines.forEach((line) => {
		  const cols = line.split('\t');
		  const ssidRaw = (cols[4] || '').trim();
		  const signal  = parseInt(cols[2], 10);
		  if (!ssidRaw) return;
		  const key = ssidRaw.toLowerCase();
		  const prev = bySsid.get(key);
		  if (!prev || signal > prev.signal) {
			bySsid.set(key, { ssid: ssidRaw, signal });
		  }
		});

		// Get list of known network SSIDs (case-insensitive)
		const knownSsids = new Set(knownRef.current.map(net => net.ssid.toLowerCase()));

		// Filter out ALL instances of known networks from scan results
		const filteredScan = Array.from(bySsid.values())
		  .filter(net => {
		    const netKey = net.ssid.toLowerCase();
		    return !knownSsids.has(netKey);
		  })
		  .sort((a, b) => b.signal - a.signal);

		// expose filtered and sorted scan list
		setScan(filteredScan);

		// merge RSSI into known networks
		setKnown((prev) =>
		  prev.map((net) => ({
		    ...net,
		    signal: bySsid.get(net.ssid.toLowerCase())?.signal,
		  }))
		);
	  } catch (err) {
		console.warn('scanNetworks error:', err);
	  } finally {
		clearTimeout(timeoutId);
		setScanning(false);
	  }
	}, [creds, iface, runPipeline, scanning]); // Remove known from dependencies


  /* 5) Connect / forget / connect-new helpers */
	const connect = useCallback(
	  async (id) => {
		if (!creds || !iface) return;
		await runPipeline([`/sbin/wpa_cli -i ${iface} select_network ${id}`]);
		// Add a delay to allow the connection to establish
		await new Promise(resolve => setTimeout(resolve, 3000));
		await refresh();
		await scanNetworks();  // Add scan after connecting
	  },
	  [creds, iface, refresh, scanNetworks, runPipeline]
	);

	const forget = useCallback(
	  async (id) => {
		if (!creds || !iface) return;
		await runPipeline([
		  `/sbin/wpa_cli -i ${iface} remove_network ${id}`,
		  `/sbin/wpa_cli -i ${iface} save_config`,
		]);
		refresh();
	  },
	  [creds, iface, refresh, runPipeline]
	);


	const connectNew = useCallback(
	  async (ssid, psk = '') => {
		if (!creds || !iface) return;  // wait for interface
		try {
		  const addOut = await runSSH({
			...creds,
			command: `/sbin/wpa_cli -i ${iface} add_network`,
		  });
		  const netId = addOut.trim();
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
	  },
	  [creds, iface, refresh, runPipeline]
	);
  const initializing = !(creds && iface && initialScanDone);

  /* 6) Public API */
  return {
	initializing,  
    creds,
    curr,
    known,
    scan,
    scanning,
    refresh,
    scanNetworks,
    connect,
    forget,
    connectNew,
  };
}
