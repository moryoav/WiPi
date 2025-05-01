// src/components/PiDashboardScreen.view.js
import React from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function PiDashboardScreenView({
  hostname,
  curr,
  known = [],
  scan = [],
  connectingId,
  modalVisible,
  modalSsid,
  modalPsk,
  scanning,
  onScan,
  onConnect,
  onForget,
  onConnectNew,
  showModal,
  hideModal,
  onChangeModalPsk,
}) {
  const getWifiIconName = (signal) => {
    // Handle null/undefined/NaN values
    if (typeof signal !== 'number' || isNaN(signal)) {
      return 'wifi-strength-off';
    }
    
    // Ensure signal is within expected range (-100 to 0)
    const normalizedSignal = Math.max(-100, Math.min(0, signal));
    
    if (normalizedSignal >= -50) return 'wifi-strength-4';
    if (normalizedSignal >= -60) return 'wifi-strength-3';
    if (normalizedSignal >= -70) return 'wifi-strength-2';
    if (normalizedSignal >= -80) return 'wifi-strength-1';
    return 'wifi-strength-off';
  };

  const KnownItem = ({ item }) => {
    const isCurrent = item.selected;
    return (
      <View style={[styles.card, isCurrent && styles.cardCurrentBorder]}>
        {/* LEFT: signal icon above dB */}
        <View style={styles.signalCol}>
          {item.signal != null ? (
            <MaterialCommunityIcons
              name={getWifiIconName(item.signal)}
              size={24}
              color="#666"
            />
          ) : (
            <MaterialCommunityIcons
              name="wifi-strength-off"
              size={24}
              color="#ccc"
            />
          )}
          {item.signal != null && (
            <Text style={styles.signalDb}>{item.signal} dB</Text>
          )}
        </View>

        {/* MIDDLE: SSID */}
        <View style={styles.infoCol}>
          <Text style={styles.rowTitle}>{item.ssid || '(hidden)'}</Text>
        </View>

        {/* RIGHT: actions */}
        <View style={styles.rowRight}>
          {/* Show “Connect” only if this network is NOT the current one */}
          {!isCurrent && (
            <Pressable
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && styles.linkBtnPressed,
              ]}
              onPress={() => onConnect(item.id)}
              disabled={item.id === connectingId}
            >
              {item.id === connectingId ? (
                <ActivityIndicator size="small" color="#0077ff" />
              ) : (
                <Text style={styles.linkBlue}>Connect</Text>
              )}
            </Pressable>
          )}
          <Pressable
            hitSlop={10}
            style={({ pressed }) => [{}, pressed && { opacity: 0.6 }]}
            onPress={() => onForget(item.id)}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={24} color="#f44336" />
          </Pressable>
        </View>
      </View>
    );
  };

  const ScanItem = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      onPress={() => showModal(item.ssid)}
    >
      <View style={styles.signalCol}>
        <MaterialCommunityIcons
          name={getWifiIconName(item.signal)}
          size={24}
          color="#666"
        />
        <Text style={styles.signalDb}>{item.signal} dB</Text>
      </View>

      <View style={styles.infoCol}>
        <Text style={styles.rowTitle}>{item.ssid}</Text>
      </View>
    </Pressable>
  );

  const sections = [
    { title: 'Known networks', data: known, renderItem: KnownItem },
    { title: 'Nearby networks', data: scan, renderItem: ScanItem },
  ];

  return (
    <View style={styles.container}>
      {/* Current connection */}
      <View style={styles.header}>
        <Text style={styles.sectionHeader}>Current connection</Text>
        {curr?.ssid ? (
          <View style={[styles.card, styles.cardCurrentBorder]}>
            <MaterialCommunityIcons
              name="wifi"
              size={24}
              color="#4caf50"
              style={styles.rowIcon}
            />
            <Text style={styles.rowTitle}>{curr.ssid}</Text>
          </View>
        ) : (
          <Text style={styles.noConnectionText}>Not connected</Text>
        )}
      </View>

      {/* Sections */}
      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => (item.id ?? item.ssid) + idx}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item, section }) =>
          section.title === 'Known networks' ? (
            <KnownItem item={item} />
          ) : (
            <ScanItem item={item} />
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Refresh FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onScan}
      >
        {scanning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="refresh" size={28} color="#fff" />
        )}
      </Pressable>

      {/* Connect-new modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={hideModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect to "{modalSsid}"</Text>
            <TextInput
              placeholder="Password (blank if open)"
              secureTextEntry
              value={modalPsk}
              onChangeText={onChangeModalPsk}
              style={styles.modalInput}
            />
            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                ]}
                onPress={async () => {
                  await onConnectNew(modalSsid, modalPsk);
                  hideModal();
                }}
              >
                <Text style={styles.primaryBtnText}>Connect</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={hideModal}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD_RADIUS = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  noConnectionText: {
    fontSize: 13,
    color: '#999',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    fontSize: 13,
    color: '#888',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardCurrentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  signalCol: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  signalDb: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  infoCol: {
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkBtn: {
    marginRight: 12,
  },
  linkBtnPressed: {
    opacity: 0.6,
  },
  linkBlue: {
    color: '#0077ff',
    fontWeight: '600',
  },
  rowIcon: {
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
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
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    backgroundColor: '#fafafa',
    fontSize: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#0077ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryBtnPressed: {
    opacity: 0.8,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: '#0077ff',
    fontWeight: '600',
  },
});
