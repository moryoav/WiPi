// src/components/PiListScreen.container.js
import React, { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location'; 
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Text,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { usePis } from '../hooks/usePis';
import {
  removePi,
  getPiCreds,
} from '../lib/storage';
import { runSSH } from '../lib/sshClient';
import PiListScreenView from '../components/PiListScreen.view';

/* helper (unchanged) */
async function fetchPiGeo({ host, username, password }) {
  const out = await runSSH({
    host,
    username,
    password,
    command: 'curl -s https://ipapi.co/latlong',
  }).catch(() => '');
  const [lat, lon] = out.trim().split(',');
  return Number.isFinite(+lat) && Number.isFinite(+lon)
    ? { lat: +lat, lng: +lon }
    : null;
}

export default function PiListScreenContainer({ navigation }) {
  const { pis, reachable, refresh } = usePis();

  const [systemInfo, setSystemInfo] = useState({});
  
  const [currentLoc, setCurrentLoc] = useState({}); // Pi IP locations
  const [deviceLoc,  setDeviceLoc]  = useState(null); // 🆕 phone location

  const [actionPi,  setActionPi]  = useState(null); // shows top bar
  const [confirmPi, setConfirmPi] = useState(null); // shows confirm dialog
  const [powerPi,   setPowerPi]   = useState(null); // restart/shutdown dialog

  /* constants */
  const NAVBAR = Platform.OS === 'android' ? 56 : 44;
  //const HEAD_H  = STATUS + NAVBAR;


 /* ── 0.  get the device location just once ─────────────────────────── */
 useEffect(() => {
   (async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;        // user said “No”

      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low      // coarse is enough for the map
      });
      setDeviceLoc({ lat: coords.latitude, lng: coords.longitude });
    } catch {
      /* ignore – keep deviceLoc null */
    }
   })();
 }, []);          // ← run only once

  /* system /system polling */
  useEffect(() => {
    let dead = false;
    (async () => {
      const next = {};
      for (const p of pis) {
        if (!reachable[p.id]) continue;
        const { apiKey } = await getPiCreds(p.id);
        if (!apiKey) continue;
        try {
          const r = await fetch(`http://${p.host}:8081/system`, {
            headers: { accept: 'application/json', access_token: apiKey },
          });
          if (r.ok) next[p.id] = await r.json();
        } catch {}
      }
      if (!dead) setSystemInfo(next);
    })();
    return () => {
      dead = true;
    };
  }, [pis, reachable]);

  /* travel log */
  const prevReach = useRef({});
  useEffect(() => {
    (async () => {
      for (const p of pis) {
        const was = prevReach.current[p.id];
        const is  = reachable[p.id];
        if (!was && is) {
          const creds = await getPiCreds(p.id);
          const geo   = await fetchPiGeo({ host: p.host, ...creds });
          if (geo) {
            const entry = { ...geo, ts: Date.now() };
            
            
            setCurrentLoc(c => ({ ...c, [p.id]: entry }));
          }
        }
        prevReach.current[p.id] = is;
      }
    })();
  }, [reachable, pis]);

  /* CRUD */
  const closeBar      = () => setActionPi(null);
  const openConfirm   = pi => { closeBar(); setConfirmPi(pi); };
  const closeConfirm  = () => setConfirmPi(null);
  const openPower    = pi => { closeBar();  setPowerPi(pi); };
  const closePower   = () => setPowerPi(null);

  const performDelete = async () => {
    if (!confirmPi) return;
    await removePi(confirmPi.id);
    setConfirmPi(null);
    refresh();
  };

	const performRestart = async () => {
	  if (!powerPi) return;
	  try {
		const creds = await getPiCreds(powerPi.id);
		await runSSH({
		  host: powerPi.host,
		  username: creds.username,
		  password: creds.password,
		  command: 'sudo reboot',
		});
	  } catch (e) {
		Alert.alert('Restart failed', e.message || 'Unable to restart Pi.');
	  } finally {
		closePower();
	  }
	};

	const performShutdown = async () => {
	  if (!powerPi) return;
	  try {
		const creds = await getPiCreds(powerPi.id);
		await runSSH({
		  host: powerPi.host,
		  username: creds.username,
		  password: creds.password,
		  command: 'sudo shutdown -h now',
		});
	  } catch (e) {
		Alert.alert('Shutdown failed', e.message || 'Unable to shutdown Pi.');
	  } finally {
		closePower();
	  }
	};
  
  const handleEdit   = pi => { closeBar(); navigation.navigate('AddPi', { pi }); };
  const handleAdd    = () => navigation.navigate('AddPi');
  const handleSelect = it => navigation.navigate('PiDashboard', { id: it.id, host: it.host });

  const showActions = pi => setActionPi(pi);
  const isPiUp = !!(actionPi && reachable[actionPi.id]);   // ← add
  /* -------------- render ------------------------------------------ */
  return (
    <>
      <PiListScreenView
        pis={pis}
        reachable={reachable}
        systemInfo={systemInfo}
        curLoc={currentLoc}
        onRefresh={refresh}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onLongSelect={showActions}
		deviceLoc={deviceLoc}
      />

      {/* ── top-bar sheet ─────────────────────────────────────────── */}
      <Modal
        visible={!!actionPi}
        transparent
        animationType="fade"
        onRequestClose={closeBar}
      >
        <Pressable style={styles.backdrop} onPress={closeBar} />

        <View style={[styles.topSheet, { height: NAVBAR }]}>
          <View style={styles.barRow}>
            <Pressable hitSlop={12} onPress={closeBar}>
              <Ionicons name="arrow-back" size={28} color="#22c55e" />
            </Pressable>

			  {/* selected Pi name */}
			  <Text numberOfLines={1} style={styles.selectedName}>
				{actionPi?.name /* or .hostname if that’s the field you store */}
			  </Text>
  
            <View style={{ flex: 1 }} />

            {/* Edit icon – 20 px from Delete */}
            <TouchableOpacity
              hitSlop={12}
              onPress={() => handleEdit(actionPi)}
              style={{ marginRight: 20 }}
            >
              <MaterialCommunityIcons name="note-edit-outline" size={28} color="#4caf50" />
            </TouchableOpacity>

            {/* Delete icon flush right */}
            <TouchableOpacity hitSlop={12} onPress={() => openConfirm(actionPi)} style={{ marginRight: 15 }}>
              <MaterialCommunityIcons name="trash-can-outline" size={28} color="#f44336" />
            </TouchableOpacity>
			
			            {/* Reset (visual only for now) */}
			<TouchableOpacity
			  hitSlop={12}
			  disabled={!isPiUp}
			  onPress={isPiUp ? () => openPower(actionPi) : undefined}
			  style={{ marginRight: 20 }}
			>
			  <MaterialCommunityIcons
				name="restart-alert"
				size={28}
				color={isPiUp ? '#ff9800' : '#bdbdbd'}
			  />
			</TouchableOpacity>
			
          </View>

          <Pressable style={styles.cancelHitArea} onPress={closeBar} />
        </View>
      </Modal>

      {/* ── modern confirm dialog ─────────────────────────────────── */}
      <Modal
        visible={!!confirmPi}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <Pressable style={styles.backdrop} onPress={closeConfirm} />

        <View style={styles.dialogBox}>
          <Text style={styles.dialogTitle}>Delete Pi</Text>
          <Text style={styles.dialogMsg}>
            Remove “{confirmPi?.name}”?
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.dBtn, styles.cancelBtn]}
              onPress={closeConfirm}
            >
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dBtn, styles.destructiveBtn]}
              onPress={performDelete}
            >
              <Text style={styles.destructiveTxt}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
	  
      {/* ── power actions dialog (new) ────────────────────────────── */}
      <Modal visible={!!powerPi} transparent animationType="fade" onRequestClose={closePower}>
        <Pressable style={styles.backdrop} onPress={closePower} />
        <View style={styles.dialogBox}>
          <Text style={styles.dialogTitle}>Power options</Text>
          

          
            <TouchableOpacity style={[styles.dBtn, styles.destructiveBtn]} onPress={performRestart}>
              <Text style={styles.destructiveTxt}>Restart</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dBtn, styles.destructiveBtn]} onPress={performShutdown}>
              <Text style={styles.destructiveTxt}>Shutdown</Text>
            </TouchableOpacity>
          

          <TouchableOpacity style={[styles.dBtn, styles.cancelBtn, { alignSelf:'flex-end', marginTop:12 }]} onPress={closePower}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>	  
	  
	  
    </>
  );
}

/* ---------------- styles ------------------------------------------ */
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },

  topSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelHitArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -24,
    height: 24,
  },

  /* confirm dialog */
  dialogBox: {
    position: 'absolute',
    top: '35%',
    left: '10%',
    right: '10%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  dialogMsg: {
    fontSize: 15,
    color: '#333',
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectedName: {
	  fontSize: 18,
	  left: 5,
  },
  cancelBtn: { backgroundColor: '#e5e7eb', marginRight: 12 },
  cancelTxt: { fontSize: 15, color: '#111' },

  destructiveBtn: { backgroundColor: '#ef4444', marginBottom: 5 },
  destructiveTxt: { fontSize: 15, color: '#fff' },
});
