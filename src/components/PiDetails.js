// src/components/PiDetails.js
import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { usePiInfo } from '../hooks/usePiInfo';

// Toggle this to false to hide debug output in production
const DEBUGMODE = false;

export default function PiDetails({ id, host, hostname }) {
  const {
    loading,
    loadingAps,
    loadingDevices,
    error,
    aps = [],
    devices = [],
    debugLogs = [],
  } = usePiInfo(id, host);

  const formatDuration = secs => {
    if (secs == null) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h:${String(m).padStart(2, '0')}m:${String(s).padStart(2, '0')}s`;
    if (m > 0) return `${m}m:${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  const copyLogs = async () => {
    await Clipboard.setStringAsync(debugLogs.join('\n'));
  };

  // Global error
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* AP Interfaces */}
      <View style={styles.sectionHeader}>
        <MaterialIcons name="router" size={18} color="#4caf50" style={styles.sectionIcon} />
        <Text style={styles.section}>AP Interfaces</Text>
      </View>
      <View style={styles.sectionContent}>
        {loadingAps ? (
          <ActivityIndicator size="small" style={styles.spinner} />
        ) : aps.length > 0 ? (
          aps.map(({ iface, ssid, channel }) => (
            <View key={iface} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.ifaceLabel}>{iface}</Text>
                <Text style={styles.channel}>Ch {channel}</Text>
              </View>
              <Text style={styles.ssid}>{ssid}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No AP interfaces found.</Text>
        )}
      </View>

      {/* Connected Devices */}
      <View style={styles.sectionHeader}>
        <MaterialIcons name="devices" size={18} color="#4caf50" style={styles.sectionIcon} />
        <Text style={styles.section}>Connected Devices</Text>
      </View>
      <View style={styles.sectionContent}>
        {(loadingAps || loadingDevices) ? (
          <ActivityIndicator size="small" style={styles.spinner} />
        ) : devices.length > 0 ? (
          devices.map(({ iface, mac, hostname: devName, lastAck, connectedSeconds }, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.macRow}>
                  <Text style={styles.deviceMac}>{mac}</Text>
                  <Text style={styles.ifaceTag}>on {iface}</Text>
                </View>
                {devName ? <Text style={styles.deviceName}>{devName}</Text> : null}
              </View>
              <View style={styles.deviceInfoRow}>
                <MaterialIcons name="wifi" size={16} color="#4caf50" />
                <Text style={styles.deviceInfoText}>{lastAck}</Text>
                <MaterialIcons name="timer" size={16} color="#666" style={{ marginLeft: 16 }} />
                <Text style={styles.deviceInfoText}>{formatDuration(connectedSeconds)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No devices connected.</Text>
        )}
      </View>

      {/* Debug Logs (if enabled) */}
      {DEBUGMODE && (
        <>
          <Text style={styles.section}>Debug Logs</Text>
          <View style={styles.sectionContent}>
            {debugLogs.length > 0 ? (
              debugLogs.map((line, i) => (
                <Text key={i} style={styles.debugText}>{line}</Text>
              ))
            ) : loading ? (
              <ActivityIndicator size="small" style={styles.spinner} />
            ) : (
              <Text style={styles.emptyText}>No debug logs.</Text>
            )}
            <Pressable style={styles.fab} onPress={copyLogs}>
              <MaterialIcons name="content-copy" size={24} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 0 },
  center: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  spinner: { marginVertical: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  sectionIcon: { marginRight: 6 },
  section: { fontSize: 14, fontWeight: '500' },
  sectionContent: { marginBottom: 2 },
  emptyText: { fontSize: 12, color: '#666', fontStyle: 'italic', marginVertical: 4 },
  errorText: { color: 'red', fontSize: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ifaceLabel: { fontSize: 12, fontWeight: '600', color: '#212121' },
  channel: { fontSize: 10, fontWeight: '600', color: '#0077ff' },
  ssid: { fontSize: 14, fontWeight: '500', color: '#333' },

  macRow: { flexDirection: 'row', alignItems: 'center' },
  deviceMac: { fontSize: 12, fontWeight: '600', color: '#212121' },
  ifaceTag: { marginLeft: 6, fontSize: 10, fontStyle: 'italic', color: '#666' },
  deviceName: { fontSize: 12, fontStyle: 'italic', color: '#666' },
  deviceInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  deviceInfoText: { fontSize: 10, color: '#666', marginLeft: 4 },

  debugText: { fontSize: 10, color: '#999', lineHeight: 14, marginBottom: 2 },
  fab: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
