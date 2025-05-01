// src/screens/PiInfoScreen.container.js

import React from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { usePiInfo } from '../hooks/usePiInfo';

// Toggle this to false to hide all debug output in production:
const DEBUGMODE = false;

export default function PiInfoScreen({ route }) {
  const { id, hostname, host } = route.params;
  const {
    loading,
    error,
    aps = [],
    devices = [],
    debugLogs = []
  } = usePiInfo(id, host);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>Loading Pi info…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </View>
    );
  }

  const formatDuration = (secs) => {
    if (secs == null) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h:${String(m).padStart(2,'0')}m:${String(s).padStart(2,'0')}s`;
    if (m > 0) return `${m}m:${String(s).padStart(2,'0')}s`;
    return `${s}s`;
  };

  const copyLogs = async () => {
    await Clipboard.setStringAsync(debugLogs.join('\n'));
  };

  return (
    <ScrollView style={styles.bg}>
      <Text style={styles.title}>Info for {hostname}</Text>

      {/* AP Interface cards */}
      {aps.map(({ iface, ssid, channel }) => (
        <View key={iface} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.ifaceLabel}>{iface}</Text>
            <Text style={styles.channel}>Ch {channel}</Text>
          </View>
          <Text style={styles.ssid}>{ssid}</Text>
        </View>
      ))}

      {/* Connected Devices */}
      <Text style={styles.section}>Connected Devices</Text>
      {devices.map(({ iface, mac, hostname, lastAck, connectedSeconds }, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.macRow}>
              <Text style={styles.deviceMac}>{mac}</Text>
              <Text style={styles.ifaceTag}>on {iface}</Text>
            </View>
            {hostname ? <Text style={styles.deviceName}>{hostname}</Text> : null}
          </View>
          <View style={styles.deviceInfoRow}>
            <MaterialIcons name="wifi" size={16} color="#4caf50" />
            <Text style={styles.deviceInfoText}>{lastAck}</Text>
            <MaterialIcons name="timer" size={16} color="#666" style={{ marginLeft: 16 }} />
            <Text style={styles.deviceInfoText}>
              {formatDuration(connectedSeconds)}
            </Text>
          </View>
        </View>
      ))}

      {/* Debug Logs (only if DEBUGMODE) */}
      {DEBUGMODE && (
        <>
          <Text style={styles.section}>Debug Logs</Text>
          {debugLogs.map((line, i) => (
            <Text key={i} style={styles.debugText}>{line}</Text>
          ))}

          {/* Copy Logs FAB */}
          <Pressable style={styles.fab} onPress={copyLogs}>
            <MaterialIcons name="content-copy" size={24} color="#fff" />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    padding: 16,
  },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  statusText: {
    marginTop: 12, fontSize: 14, color: '#666'
  },
  title: {
    fontSize: 20, fontWeight: '600', marginBottom: 16
  },
  section: {
    fontSize: 16, fontWeight: '500', marginTop: 24, marginBottom: 8
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  macRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ifaceLabel: {
    fontSize: 14, fontWeight: '600', color: '#212121'
  },
  channel: {
    fontSize: 12, fontWeight: '600', color: '#0077ff'
  },
  ssid: {
    fontSize: 16, fontWeight: '500', color: '#333'
  },
  deviceMac: {
    fontSize: 14, fontWeight: '600', color: '#212121'
  },
  ifaceTag: {
    marginLeft: 8,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
  },
  deviceName: {
    fontSize: 14, fontStyle: 'italic', color: '#666'
  },
  deviceInfoRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 8
  },
  deviceInfoText: {
    fontSize: 12, color: '#666', marginLeft: 4
  },
  debugText: {
    fontSize: 12, color: '#999', lineHeight: 16
  },
  errorText: {
    color: 'red', fontSize: 14
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
});
