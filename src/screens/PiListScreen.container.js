// src/components/PiListScreen.container.js
import React, { useState, useEffect, useRef } from 'react';
import { usePis } from '../hooks/usePis';
import { removePi, getPiCreds, getPiLocations, addPiLocation } from '../lib/storage';
import { runSSH } from '../lib/sshClient';
import PiListScreenView from '../components/PiListScreen.view';

async function fetchPiGeo({ host, username, password }) {
  const cmd = 'curl -s https://ipapi.co/latlong';
  const out = await runSSH({ host, username, password, command: cmd }).catch(() => '');
  const [lat, lon] = out.trim().split(',');
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  return Number.isFinite(latNum) && Number.isFinite(lonNum) ? { lat: latNum, lng: lonNum } : null;
}

export default function PiListScreenContainer({ navigation }) {
  const { pis, reachable, refresh } = usePis();
  const [systemInfo, setSystemInfo] = useState({});
  const [locHistory, setLocHistory] = useState({});
  const [currentLoc, setCurrentLoc] = useState({});

  useEffect(() => {
    (async () => {
      const map = {};
      for (const pi of pis) map[pi.id] = await getPiLocations(pi.id);
      setLocHistory(map);
      const cur = {};
      Object.entries(map).forEach(([id, arr]) => { if (arr.length) cur[id] = arr[arr.length - 1]; });
      setCurrentLoc(cur);
    })();
  }, [pis]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const pi of pis) {
        if (!reachable[pi.id]) continue;
        const { apiKey } = await getPiCreds(pi.id);
        if (!apiKey) continue;
        try {
          const r = await fetch(`http://${pi.host}:8081/system`, {
            headers: { accept: 'application/json', access_token: apiKey },
          });
          if (r.ok) next[pi.id] = await r.json();
        } catch {};
      }
      if (!cancelled) setSystemInfo(next);
    })();
    return () => { cancelled = true; };
  }, [pis, reachable]);

  const prevReach = useRef({});
  useEffect(() => {
    (async () => {
      for (const pi of pis) {
        const wasUp = prevReach.current[pi.id];
        const isUp = reachable[pi.id];
        if (!wasUp && isUp) {
          const creds = await getPiCreds(pi.id);
          const geo = await fetchPiGeo({ host: pi.host, username: creds.username, password: creds.password });
          if (geo) {
            const entry = { ...geo, ts: Date.now() };
            await addPiLocation(pi.id, entry);
            setLocHistory(h => ({ ...h, [pi.id]: [...(h[pi.id] || []), entry] }));
            setCurrentLoc(c => ({ ...c, [pi.id]: entry }));
          }
        }
        prevReach.current[pi.id] = isUp;
      }
    })();
  }, [reachable, pis]);

  const handleDelete = async id => { await removePi(id); refresh(); };
  const handleSelect = item => navigation.navigate('PiDashboard', { id: item.id, host: item.host });
  const handleAdd = () => navigation.navigate('AddPi');
  const handleEdit = item => navigation.navigate('AddPi', { pi: item });

  return (
    <PiListScreenView
      pis={pis}
      reachable={reachable}
      systemInfo={systemInfo}
      locHistory={locHistory}
      curLoc={currentLoc}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onAdd={handleAdd}
      onEdit={handleEdit}
    />
  );
}