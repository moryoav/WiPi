// src/components/PiListScreen.view.js
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

/* ─── Gauge & Status widgets ────────────────────────────────────────── */
function Gauge({ label, percent, color }) {
  const pct = Math.max(0, Math.min(percent, 100));
  return (
    <View style={styles.gaugeRow}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <View style={styles.gaugeBar}>
        <View
          style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={styles.gaugeValue}>{pct.toFixed(0)}%</Text>
    </View>
  );
}

function StatusIndicator({ label, on }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Ionicons
        name={on ? 'checkmark-circle' : 'close-circle'}
        size={18}
        color={on ? '#4caf50' : '#f44336'}
        style={{ marginLeft: 6 }}
      />
    </View>
  );
}

/* ─── TravelMap overlay ─────────────────────────────────────────────── */
const PIN_SIZE = 8;
const MAP_ASPECT = 4424 / 2214; // width / height of your PNG

export function TravelMap({ history = [], current }) {
  // combine history + current, plus a debug origin
  const pins = [...history];
  if (current) pins.push({ ...current, isCurrent: true });
  //pins.push({ lat: 0, lng: 0, isOrigin: true });

  const [dims, setDims] = useState(null);

  return (
    <View
      style={styles.mapContainer}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!dims || dims.width !== width || dims.height !== height) {
          setDims({ width, height });
        }
      }}
    >
      <Image
        source={require('../../assets/map.jpg')}
        style={styles.mapImage}
        resizeMode="cover"   // fills the container exactly
      />

      {dims &&
        pins.map((p, i) => {
          // equirectangular: lon→x, lat→y
          const x = ((p.lng + 180) / 360) * dims.width;
          const y = ((90 - p.lat) / 180) * dims.height;

          let color = 'blue';
          if (p.isCurrent) color = 'red';
          else if (p.isOrigin) color = 'limegreen';

          return (
            <View
              key={i}
              style={[
                styles.pin,
                {
                  left: x - PIN_SIZE / 2,
                  top: y - PIN_SIZE / 2,
                  backgroundColor: color,
                },
              ]}
            />
          );
        })}
    </View>
  );
}

/* ─── Main card view ───────────────────────────────────────────────── */
export default function PiListScreenView({
  pis,
  reachable,
  systemInfo,
  locHistory,
  curLoc,
  onSelect,
  onDelete,
  onAdd,
  onEdit,
}) {
  const confirmDelete = (item) =>
    Alert.alert('Delete Pi', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);

  const renderItem = ({ item }) => {
    const isUp = reachable[item.id];
    const sys = systemInfo[item.id];
    const hist = locHistory[item.id] || [];
    const curr = curLoc[item.id];

    const ramPct = sys?.usedMemory ?? null;
    const cpuPct = sys?.systemLoadPercentage ?? null;
    const tempPct = sys ? (sys.systemTemperature / 85) * 100 : null;
    const hostapdOn = sys?.hostapdStatus === 1;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isUp ? styles.cardReachable : styles.cardUnreachable,
          pressed && isUp && styles.cardPressed,
        ]}
        android_ripple={isUp ? { color: 'rgba(0,0,0,0.05)' } : undefined}
        onPress={isUp ? () => onSelect(item) : null}
        onLongPress={() => confirmDelete(item)}
        disabled={!isUp}
      >
        {/* ─── top row: info + icons */}
        <View style={styles.cardRow}>
          <View style={styles.textCol}>
            <View style={styles.nameRow}>
              <MaterialIcons
                name={isUp ? 'wifi' : 'wifi-off'}
                size={18}
                color={isUp ? '#4caf50' : '#9e9e9e'}
                style={styles.statusIcon}
              />
              <Text style={[styles.name, !isUp && styles.dimText]}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.host}>{item.host}</Text>
            {sys && (
              <View style={styles.sysBox}>
                {ramPct != null && <Gauge label="RAM" percent={ramPct} color="#2196f3" />}
                {cpuPct != null && <Gauge label="CPU" percent={cpuPct} color="#ff9800" />}
                {tempPct != null && <Gauge label="Temp" percent={tempPct} color="#e53935" />}
                {sys.hostapdStatus != null && (
                  <StatusIndicator label="hostapd" on={hostapdOn} />
                )}
                <Text style={styles.extraText}>
                  {sys.uptime}{'\n'}
                  {sys.operatingSystem}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.iconCol}>
            <Pressable hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.7 }} onPress={() => onEdit(item)}>
              <MaterialIcons name="edit" size={28} color="#4caf50" />
            </Pressable>
            <Pressable hitSlop={12} style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]} onPress={() => confirmDelete(item)}>
              <MaterialIcons name="delete" size={32} color="#f44336" />
            </Pressable>
          </View>
        </View>

        {/* ─── full‐width separator + TravelMap */}
        {hist.length > 0 && (
          <>
            <View style={styles.separatorFull} />
            <Text style={styles.travelHdr}>My Travels</Text>
            <TravelMap history={hist} current={curr} />
          </>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pis}
        keyExtractor={(pi) => pi.id}
        renderItem={renderItem}
        contentContainerStyle={[{ flexGrow: 1 }, !pis.length && { justifyContent: 'center' }]}
        ListEmptyComponent={<Text style={styles.empty}>No Pis yet. Tap + to add one.</Text>}
        showsVerticalScrollIndicator={false}
      />
      <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} android_ripple={{ color: 'rgba(255,255,255,0.3)' }} onPress={onAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────────────── */
const CARD_RADIUS = 12;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },

  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardReachable: { borderLeftWidth: 4, borderLeftColor: '#4caf50' },
  cardUnreachable: { borderLeftWidth: 4, borderLeftColor: '#9e9e9e' },
  cardPressed: { transform: [{ scale: 0.99 }] },

  cardRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  textCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusIcon: { marginRight: 6 },
  name: { fontSize: 16, fontWeight: '600', color: '#212121' },
  host: { fontSize: 12, color: '#616161' },
  dimText: { color: '#9e9e9e' },

  sysBox: { marginTop: 10 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  gaugeLabel: { width: 50, fontSize: 11, color: '#424242' },
  gaugeBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  gaugeFill: { height: '100%', borderRadius: 3 },
  gaugeValue: { width: 32, fontSize: 11, color: '#424242', textAlign: 'right' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusLabel: { fontSize: 11, color: '#424242' },
  extraText: { marginTop: 4, fontSize: 10, color: '#757575', lineHeight: 14 },

  separatorFull: { height: 1, backgroundColor: '#e0e0e0', marginTop: 10 },
  travelHdr: { fontSize: 13, fontWeight: '600', margin: 10, color: '#374151' },

  mapContainer: {
    width: '100%',
    aspectRatio: MAP_ASPECT,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 1,
    borderColor: '#fff',
  },

  iconCol: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, marginRight: 12 },
  deleteBtn: { marginLeft: 8 },
  empty: { textAlign: 'center', fontSize: 14, color: '#9e9e9e' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
