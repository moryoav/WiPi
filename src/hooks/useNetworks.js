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

  const [initialScanDone, setInitialScanDone] = useState(false);
  const initialLoadStarted = useRef(false);
  const knownRef = useRef([]);
  useEffect(() => { knownRef.current = known; }, [known]);

  /* 1) Load SSH creds & detect client interface */
  useEffect(() => {
    (async () => {
      try {
        const c = await getPiCreds(piId);
        setCreds({ host, ...c });

        const rawIfaceOut = await runSSH({
          host,
          ...c,
          command: `bash -lc "iw dev | awk '/Interface/ {print $2}'"`
        });
        //console.log('useNetworks: raw iface output:', rawIfaceOut);
        const ifaceRaw = rawIfaceOut.trim().split('\n')[0] || '';
        const ifaceClean = ifaceRaw.replace(/^\s*Interface\s+/, '').trim();
        //console.log('useNetworks: detected client iface:', ifaceClean);
        setIface(ifaceClean);
      } catch (err) {
        console.warn('Failed to load creds or detect iface:', err);
      }
    })();
  }, [piId, host]);

  /* 2) run multiple commands in one SSH session */
  const runPipeline = useCallback(
    async (cmds) => {
      if (!creds) throw new Error('SSH credentials not ready');
      return await runSSH({ ...creds, command: `bash -lc "${cmds.join(' && ')}"` });
    }, [creds]
  );

  /* 3) Refresh current + known */
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

  /* 4) Scan networks & exclude AP SSIDs */
  const scanNetworks = useCallback(async () => {
    if (!creds || !iface || scanning) return;

    setScanning(true);
    const timeoutId = setTimeout(() => setScanning(false), 10000);
	
    //console.log('scanNetworks: detecting AP interfaces...');
    let apSsids = [];
    try {
      const rawIfacesOut = await runPipeline([`/usr/sbin/iw dev | awk '/Interface/ {print $2}'`]);
      //console.log('scanNetworks: raw interfaces output:', rawIfacesOut);
      const allIfaces = rawIfacesOut
        .trim()
        .split('\n')
        .map(l => l.replace(/^\s*Interface\s+/, '').trim())
        .filter(Boolean);
      //console.log('scanNetworks: parsed interfaces:', allIfaces);

      const apIfaces = [];
      for (const name of allIfaces) {
        const infoOut = await runPipeline([`/usr/sbin/iw dev ${name} info`]);
        if (infoOut.includes('type AP')) apIfaces.push(name);
      }
      //console.log('scanNetworks: detected AP interfaces:', apIfaces);

      for (const ap of apIfaces) {
        const infoOut = await runPipeline([`/usr/sbin/iw dev ${ap} info`]);
        const m = infoOut.match(/^\s*ssid\s+(.+)$/m);
        if (m) apSsids.push(m[1].trim());
      }
      //console.log('scanNetworks: AP SSIDs to exclude:', apSsids);
    } catch (err) {
      //console.warn('scanNetworks: AP detection error:', err);
    }



    try {
      //console.log('scanNetworks: scanning on iface:', iface);
      const scanOut = await runPipeline([
        `/sbin/wpa_cli -i ${iface} scan`,
        'sleep 2',
        `/sbin/wpa_cli -i ${iface} scan_results`,
      ]);
      //console.log('scanNetworks: raw scan output:', scanOut);
      const lines = scanOut.trim().split('\n');
      const dataLines = lines.slice(1);

      const bySsid = new Map();
      dataLines.forEach(line => {
        const cols = line.split('\t');
        const ssid = (cols[4] || '').trim();
        const signal = parseInt(cols[2], 10);
        if (!ssid) return;
        const key = ssid.toLowerCase();
        const prev = bySsid.get(key);
        if (!prev || signal > prev.signal) bySsid.set(key, { ssid, signal });
      });
      //console.log('scanNetworks: bySsid keys:', Array.from(bySsid.keys()));

      const knownSet = new Set(knownRef.current.map(n => n.ssid.toLowerCase()));
      //console.log('scanNetworks: knownSsids:', Array.from(knownSet));

      let candidates = Array.from(bySsid.values()).filter(n => !knownSet.has(n.ssid.toLowerCase()));
      //console.log('scanNetworks: candidates before AP filter:', candidates.map(n => n.ssid));

      const apSet = new Set(apSsids.map(s => s.toLowerCase()));
      //console.log('scanNetworks: apSsidsLower:', Array.from(apSet));

      // ★ SORT: by descending signal strength
      const filtered = candidates
        .filter(n => !apSet.has(n.ssid.toLowerCase()))
        .sort((a, b) => b.signal - a.signal);
      //console.log('scanNetworks: filtered after AP filter:', filtered.map(n => n.ssid));

      setScan(filtered);
      setKnown(prev => prev.map(n => ({
        ...n,
        signal: bySsid.get(n.ssid.toLowerCase())?.signal,
      })));
      if (!initialScanDone) setInitialScanDone(true);
    } catch (err) {
      console.warn('scanNetworks error:', err);
    } finally {
      clearTimeout(timeoutId);
      setScanning(false);
    }
  }, [creds, iface, scanning, runPipeline, initialScanDone]);

  /* 5) Bootstrap on first load */
  useEffect(() => {
    if (!creds || !iface || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    (async () => { await refresh(); await scanNetworks(); })();
  }, [creds, iface, refresh, scanNetworks]);

  /* 6) Actions */
  const connect = useCallback(async id => {
    if (!creds || !iface) return;
    await runPipeline([`/sbin/wpa_cli -i ${iface} select_network ${id}`]);
    await new Promise(r => setTimeout(r, 3000));
    await refresh();
    await scanNetworks();
  }, [creds, iface, runPipeline, refresh, scanNetworks]);

  const forget = useCallback(async id => {
    if (!creds || !iface) return;
    await runPipeline([
      `/sbin/wpa_cli -i ${iface} remove_network ${id}`,
      `/sbin/wpa_cli -i ${iface} save_config`,
    ]);
    await refresh();
    await scanNetworks();
  }, [creds, iface, runPipeline, refresh, scanNetworks]);
/*
  const connectNew = useCallback(async (ssid, psk = '') => {
    if (!creds || !iface) return;
    try {
      const newIdOut = await runSSH({
        ...creds,
        command: `/sbin/wpa_cli -i ${iface} add_network`,
      });
      const netId = newIdOut.trim();
      const cmds = [
        `/sbin/wpa_cli -i ${iface} set_network ${netId} ssid '"${ssid}"'`,
        psk
          ? `/sbin/wpa_cli -i ${iface} set_network ${netId} psk '"${psk}"'`
          : `/sbin/wpa_cli -i ${iface} set_network ${netId} key_mgmt NONE`,
        `/sbin/wpa_cli -i ${iface} enable_network ${netId}`,
        `/sbin/wpa_cli -i ${iface} select_network ${netId}`,
        `/sbin/wpa_cli -i ${iface} save_config`,
      ];
	  console.log(cmds);
      await runPipeline(cmds);
    } catch (err) {
      console.warn('connectNew error:', err);
    } finally {
      setTimeout(refresh, 1000);
      setScan([]);
    }
  }, [creds, iface, runPipeline, refresh]);
*/
	const connectNew = useCallback(async (ssid, psk = '') => {
	  if (!creds || !iface) return;

	  try {
		setScanning(true);
		/* 1. create an empty network and capture its numeric id */
		const newIdOut = await runSSH({
		  ...creds,
		  command: `/sbin/wpa_cli -i ${iface} add_network`,
		});
		const netId = newIdOut.trim();

		/* 2. helper – proper quoting for ssid / psk */
		const q = s => `'"${s}"'`;

		/* 3. build the exact command list we want to run */
		const cmds = [
		  `/sbin/wpa_cli -i ${iface} set_network ${netId} ssid ${q(ssid)}`,
		  psk
			? `/sbin/wpa_cli -i ${iface} set_network ${netId} psk ${q(psk)}`
			: `/sbin/wpa_cli -i ${iface} set_network ${netId} key_mgmt NONE`,
		  `/sbin/wpa_cli -i ${iface} enable_network ${netId}`,
		  `/sbin/wpa_cli -i ${iface} select_network ${netId}`,
		  `/sbin/wpa_cli -i ${iface} save_config`,
		];

		const scriptPath    = `/tmp/connect_${netId}.sh`;
		const scriptContent = cmds.join('\n') + '\n';
		
		/* 4. write the shell script onto the Pi */
		
		await runSSH({
		  ...creds,
		  command: [
			'bash -lc',                // run everything in one remote bash
			`"cat > ${scriptPath} <<'EOS'"`,
			scriptContent,             // all wpa_cli commands, one per line
			'EOS',
			`chmod +x ${scriptPath}`,
		  ].join('\n'),
		});
		
		/* 5. execute the script (leave it there for inspection) */
		await runSSH({
		  ...creds,
		  command: `bash -lc "sudo ${scriptPath}"`,
		});

	  } catch (err) {
		console.warn('connectNew error:', err);
	  } finally {
		/* refresh lists & clear transient scan candidates */
		
		//setScan([]);
		await new Promise(r => setTimeout(r, 3000));
		await refresh();
		await scanNetworks();
	  }
	}, [creds, iface, refresh, scanNetworks]);

  /* 7) Public API */
  const initialLoading = !initialScanDone;
  return { initialLoading, scanning, creds, curr, known, scan, refresh, scanNetworks, connect, forget, connectNew };
}
