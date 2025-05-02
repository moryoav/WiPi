// src/components/PiListScreen.view.js
import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

/* ─── Gauge & Status helpers (unchanged) ───────────────────────── */
function Gauge({ label, percent, color }) {
  const pct = Math.max(0, Math.min(percent, 100));
  return (
    <View style={styles.gaugeRow}>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <View style={styles.gaugeBar}>
        <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
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

/* ─────────────────────────────────────────────────────────────── */

export default function PiListScreenView({
  pis,
  reachable,
  systemInfo,
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
    const isReachable = reachable[item.id];
    const sys = systemInfo[item.id];

    const usedMemPct = sys?.usedMemory ?? null;
    const cpuPct     = sys?.systemLoadPercentage ?? null;
    const tempPct    = sys ? (sys.systemTemperature / 85) * 100 : null;
    const hostapdOn  = sys?.hostapdStatus === 1;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isReachable ? styles.cardReachable : styles.cardUnreachable,
          pressed && isReachable && styles.cardPressed,
        ]}
        android_ripple={isReachable ? { color: 'rgba(0,0,0,0.05)' } : undefined}
        onPress={isReachable ? () => onSelect(item) : null}
        onLongPress={() => confirmDelete(item)}
        disabled={!isReachable}
      >
        <View style={styles.cardRow}>
          {/* LEFT column */}
          <View style={styles.textCol}>
            <View style={styles.nameRow}>
              <MaterialIcons
                name={isReachable ? 'wifi' : 'wifi-off'}
                size={18}
                color={isReachable ? '#4caf50' : '#9e9e9e'}
                style={styles.statusIcon}
              />
              <Text style={[styles.name, !isReachable && styles.dimText]}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.host}>{item.host}</Text>

            {sys && (
              <View style={styles.sysBox}>
                {usedMemPct != null && <Gauge label="RAM"  percent={usedMemPct} color="#2196f3" />}
                {cpuPct     != null && <Gauge label="CPU"  percent={cpuPct}   color="#ff9800" />}
                {tempPct    != null && <Gauge label="Temp" percent={tempPct}  color="#e53935" />}
                {sys.hostapdStatus != null && (
                  <StatusIndicator label="hostapd" on={hostapdOn} />
                )}

                {/* uptime ↵ OS (with explicit line-break) */}
                <Text style={styles.extraText}>
                  {sys.uptime}{'\n'}{sys.operatingSystem}
                </Text>
              </View>
            )}
          </View>

          {/* RIGHT column: now pinned to TOP */}
          <View style={styles.iconCol}>
            <Pressable
              hitSlop={12}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
              onPress={() => onEdit(item)}
            >
              <MaterialIcons name="edit" size={28} color="#4caf50" />
            </Pressable>

            <Pressable
              hitSlop={12}
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
              onPress={() => confirmDelete(item)}
            >
              <MaterialIcons name="delete" size={32} color="#f44336" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pis}
        keyExtractor={(pi) => pi.id}
        renderItem={renderItem}
        contentContainerStyle={[
          { flexGrow: 1 },
          !pis.length && { justifyContent: 'center' },
        ]}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No Pis yet. Tap the + button to add your first Pi.
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
        onPress={onAdd}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────── */
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

  /* system dashboard */
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

  /* RIGHT-side icon column pinned to TOP */
  iconCol: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',  // ← keeps icons at top of card
  },
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
