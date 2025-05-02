import React, { useState, useEffect } from 'react';
import { usePis } from '../hooks/usePis';
import { removePi, getPiCreds } from '../lib/storage';
import PiListScreenView from '../components/PiListScreen.view';

export default function PiListScreenContainer({ navigation }) {
  const { pis, reachable, refresh } = usePis();

  /* hold per-Pi “/system” JSON (overwritten on each refresh) */
  const [systemInfo, setSystemInfo] = useState({});

  /* ------------------------------------------------------------------
   * Re-query RaspAP “/system” every time the caller refreshes Pis OR
   * reachability changes.
   * ----------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextInfo = {};

      for (const pi of pis) {
        if (!reachable[pi.id]) continue;              // must be online

        /* pull API Key from secure creds */
        const { apiKey } = await getPiCreds(pi.id);
        if (!apiKey) continue;                        // skip if none

        try {
          const resp = await fetch(`http://${pi.host}:8081/system`, {
            headers: {
              accept: 'application/json',
              access_token: apiKey,
            },
          });
          if (resp.ok) {
            nextInfo[pi.id] = await resp.json();
          }
        } catch (_) {
          /* ignore network errors */
        }
      }

      if (!cancelled) setSystemInfo(nextInfo);        // overwrite
    })();

    return () => { cancelled = true; };
  }, [pis, reachable]);                               // ← fires after every refresh

  /* CRUD handlers --------------------------------------------------- */
  const handleDelete = async (id) => {
    await removePi(id);
    refresh();                                        // triggers useEffect above
  };

  const handleSelect = (item) =>
    navigation.navigate('PiDashboard', {
      id: item.id,
      hostname: item.name,
      host: item.host,
      username: item.username,
    });

  const handleAdd  = () => navigation.navigate('AddPi');
  const handleEdit = (item) => navigation.navigate('AddPi', { pi: item });

  /* ---------------------------------------------------------------- */
  return (
    <PiListScreenView
      pis={pis}
      reachable={reachable}
      systemInfo={systemInfo}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onAdd={handleAdd}
      onEdit={handleEdit}
    />
  );
}
