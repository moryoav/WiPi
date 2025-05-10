// src/components/PiDashboardScreen.view.js

import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons, // ← added for eye-toggle icon
} from '@expo/vector-icons';
import { runSpeedTest } from '../lib/speedtestHelper';

export default function PiDashboardScreenView({
  /* ----- props ----- */
  initialLoading,            // spinner overlay until first scan finishes
  hostname,
  host,                      // SSH host for speedtestHelper
  curr,
  known = [],
  scan  = [],
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
  /* ───────── component state ───────── */
  const [speedLoading, setSpeedLoading]  = useState(false);
  const [showSpeedHelp, setShowSpeedHelp] = useState(false);
  const [speedResults, setSpeedResults]  = useState(null);
  const [showPassword, setShowPassword]  = useState(false);   // ← eye-toggle state

  /* ───────── speed-test handler ───────── */
  const handleSpeedTest = async () => {
    setSpeedLoading(true);
    try {
      const results = await runSpeedTest(host);
      setSpeedResults(results);
    } catch (e) {
      //console.error('SpeedTest error', e);
	  setShowSpeedHelp(true); 
    } finally {
      setSpeedLoading(false);
    }
  };

  /* ───────── helpers ───────── */
  const getWifiIconName = (signal) => {
    if (typeof signal !== 'number' || isNaN(signal)) return 'wifi-strength-off';
    const s = Math.max(-100, Math.min(0, signal));
    if (s >= -50) return 'wifi-strength-4';
    if (s >= -60) return 'wifi-strength-3';
    if (s >= -70) return 'wifi-strength-2';
    if (s >= -80) return 'wifi-strength-1';
    return 'wifi-strength-alert-outline';
  };

  /* ───────── row components ───────── */
  const KnownItem = ({ item }) => {
    const isCurrent = item.selected;
    return (
      <View style={[styles.card, isCurrent && styles.cardCurrentBorder]}>
        <View style={styles.signalCol}>
          {item.signal != null ? (
            <MaterialCommunityIcons
              name={getWifiIconName(item.signal)}
              size={24}
              color="#666"
            />
          ) : (
            <MaterialCommunityIcons name="wifi-strength-off" size={24} color="#ccc" />
          )}
          {item.signal != null && <Text style={styles.signalDb}>{item.signal} dB</Text>}
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.rowTitle}>{item.ssid || '(hidden)'}</Text>
        </View>
        <View style={styles.rowRight}>
          {!isCurrent && (
            <Pressable
              style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
              onPress={() => onConnect(item.id)}
              disabled={item.id === connectingId}
            >
              {item.id === connectingId
                ? <ActivityIndicator size="small" color="#0077ff" />
                : <Text style={styles.linkBlue}>Connect</Text>}
            </Pressable>
          )}
          <Pressable
            hitSlop={10}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
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
        <MaterialCommunityIcons name={getWifiIconName(item.signal)} size={24} color="#666" />
        <Text style={styles.signalDb}>{item.signal} dB</Text>
      </View>
      <View style={styles.infoCol}>
        <Text style={styles.rowTitle}>{item.ssid}</Text>
      </View>
    </Pressable>
  );

  /* ───────── dynamic section list ───────── */
  const sections = [];
  if (known.length > 0)
    sections.push({ title: 'Known networks', data: known, renderItem: KnownItem });
  if (scan.length > 0)
    sections.push({ title: 'Nearby networks', data: scan, renderItem: ScanItem });

  return (
    <View style={styles.container}>
      {/* ── Current connection ── */}
      {curr?.ssid && (
        <View style={styles.header}>
          <Text style={styles.sectionHeader}>Current connection</Text>

          <View style={[styles.card, styles.cardCurrentBorder, styles.cardColumn]}>
            {/* first row */}
            <View style={styles.currentRow}>
              <MaterialCommunityIcons
                name="wifi"
                size={24}
                color="#4caf50"
                style={styles.rowIcon}
              />
              <Text style={styles.rowTitle}>{curr.ssid}</Text>
              <Pressable
                style={({ pressed }) => [styles.speedBtn, pressed && styles.speedBtnPressed]}
                onPress={handleSpeedTest}
                disabled={speedLoading}
              >
                {speedLoading ? (
                  <ActivityIndicator size="small" color="#0077ff" />
                ) : (
                  <MaterialCommunityIcons name="speedometer" size={32} color="#0077ff" />
                )}
              </Pressable>
            </View>

            {/* speed test results */}
            {speedResults && (() => {
              const rawMax           = Math.ceil((speedResults.download * 1.1) / 10) * 10;
              const gaugeMax         = Math.max(rawMax, 25);
              const seg1             = 4;
              const seg2             = 4;
              const seg3             = 17;             // 25 − (4+4)
              const seg4             = gaugeMax - 25;  // may be zero
              const indicatorPercent = (speedResults.download / gaugeMax) * 100;

              return (
                <>
                  <View style={styles.speedRow}>
                    <View style={styles.speedCol}>
                      <MaterialCommunityIcons
                        name="download"
                        size={24}
                        color="#212121"
                        style={styles.speedIcon}
                      />
                      <Text style={styles.speedValue}>
                        {speedResults.download.toFixed(1)} Mbps
                      </Text>
                      <Text style={styles.speedLabel}>Download</Text>
                    </View>
                    <View style={styles.speedCol}>
                      <MaterialCommunityIcons
                        name="upload"
                        size={24}
                        color="#212121"
                        style={styles.speedIcon}
                      />
                      <Text style={styles.speedValue}>
                        {speedResults.upload.toFixed(1)} Mbps
                      </Text>
                      <Text style={styles.speedLabel}>Upload</Text>
                    </View>
                    <View style={styles.speedCol}>
                      <MaterialCommunityIcons
                        name="timer"
                        size={24}
                        color="#212121"
                        style={styles.speedIcon}
                      />
                      <Text style={styles.speedValue}>
                        {speedResults.ping.toFixed(0)} ms
                      </Text>
                      <Text style={styles.speedLabel}>Ping</Text>
                    </View>
                  </View>

                  <View style={styles.speedGaugeContainer}>
                    <View style={styles.speedGaugeBar}>
                      <View style={[styles.speedGaugeSegment, { flex: seg1, backgroundColor: '#f44336' }]} />
                      <View style={[styles.speedGaugeSegment, { flex: seg2, backgroundColor: '#ff9800' }]} />
                      <View style={[styles.speedGaugeSegment, { flex: seg3, backgroundColor: '#ffeb3b' }]} />
                      {seg4 > 0 && (
                        <View style={[styles.speedGaugeSegment, { flex: seg4, backgroundColor: '#4caf50' }]} />
                      )}
                      <View
                        style={[
                          styles.speedGaugeIndicator,
                          { left: `${indicatorPercent}%` },
                        ]}
                      />
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
		  
			<Modal
			  transparent
			  visible={showSpeedHelp}
			  animationType="fade"
			  onRequestClose={() => setShowSpeedHelp(false)}
			>
			  <View style={styles.helpOverlay}>
				<View style={styles.helpCard}>
				  <Text style={styles.helpTitle}>Speed-test service not found</Text>
				  <Text style={styles.helpBody}>
					This feature needs the&nbsp;
					<Text
					  style={styles.helpLink}
					  onPress={() =>
						Linking.openURL(
						  'https://docs.miguelndecarvalho.pt/projects/speedtest-exporter/'
						)
					  }
					>
					  speedtest-exporter
					</Text>{' '}
					package running on the Pi.
				  </Text>

				  <Pressable
					style={styles.helpCloseBtn}
					onPress={() => setShowSpeedHelp(false)}
				  >
					<Text style={styles.helpCloseTxt}>Got it</Text>
				  </Pressable>
				</View>
			  </View>
			</Modal>
		  
		  
		  
        </View>
      )}

      {/* ── Section list ── */}
      {sections.length > 0 && (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => (item.id ?? item.ssid) + idx}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.title === 'Known networks'
              ? <KnownItem item={item} />
              : <ScanItem  item={item} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
		  onRefresh={onScan}           
		  refreshing={scanning}
        />
      )}

      {/* ── Refresh FAB ── */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={onScan}
      >
        {scanning
          ? <ActivityIndicator color="#fff" />
          : <Ionicons name="refresh" size={28} color="#fff" />}
      </Pressable>



      {/* ── Connect-new modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={hideModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect to "{modalSsid}"</Text>

            {/* password field + eye icon */}
            <View style={styles.passwordRow}>
              <TextInput
                placeholder="Password (blank if open)"
                secureTextEntry={!showPassword}
                value={modalPsk}
                onChangeText={onChangeModalPsk}
                style={[
                  styles.modalInput,
                  {
                    flex: 1,
                    marginBottom: 0,
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0,
                    borderRightWidth: 0,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={24}
                  color="#666"
                />
              </Pressable>
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                onPress={async () => {
                  hideModal();
                  onConnectNew(modalSsid, modalPsk);
                }}
              >
                <Text style={styles.primaryBtnText}>Connect</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
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
  /* ───── container & headers ───── */
  container:        { flex: 1, backgroundColor: '#f4f6f8' },
  header:           { paddingTop: 20, paddingBottom: 0 },
  sectionHeader:    { paddingHorizontal: 20, paddingTop: 12, fontSize: 13, color: '#888' },

  /* ───── universal card ───── */
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
  cardPressed:      { transform: [{ scale: 0.98 }] },
  cardCurrentBorder:{ borderLeftWidth: 4, borderLeftColor: '#4caf50' },
  cardColumn:       { flexDirection: 'column', alignItems: 'flex-start' },

  /* ───── rows inside cards ───── */
  currentRow:       { flexDirection: 'row', alignItems: 'center', width: '100%' },
  rowIcon:          { marginRight: 10 },
  rowTitle:         { fontSize: 16, fontWeight: '500', color: '#212121' },

  /* speed button */
  speedBtn:         { marginLeft: 'auto', padding: 8 },
  speedBtnPressed:  { opacity: 0.6 },

  /* signal column */
  signalCol: { width: 50, alignItems: 'center', marginRight: 12 },
  signalDb:  { marginTop: 4, fontSize: 12, color: '#666' },

  /* row right actions */
  infoCol:   { flex: 1 },
  rowRight:  { flexDirection: 'row', alignItems: 'center' },
  linkBtn:   { marginRight: 12 },
  linkBtnPressed:{ opacity: 0.6 },
  linkBlue:  { color: '#0077ff', fontWeight: '600' },

  /* speed results */
  speedRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, width: '100%' },
  speedCol:  { flex: 1, alignItems: 'center' },
  speedIcon: { marginBottom: 4 },
  speedValue:{ fontSize: 16, fontWeight: '600', color: '#212121' },
  speedLabel:{ fontSize: 12, color: '#666', marginTop: 2 },

  /* speed gauge */
  speedGaugeContainer: { width: '100%', marginTop: 8 },
  speedGaugeBar: {
    flexDirection: 'row',
    width: '100%',
    height: 8,
    borderRadius: 4,
    position: 'relative',
  },
  speedGaugeSegment:  { height: '100%' },
  speedGaugeIndicator:{
    position: 'absolute',
    width: 3,
    height: 13,
    backgroundColor: '#212121',
    top: -3,
  },

  /* ───── FAB ───── */
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
  fabPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },

  /* ───── first-scan overlay ───── */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  /* ───── modal ───── */
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard:   { width: '85%', backgroundColor: '#fff', borderRadius: CARD_RADIUS, padding: 20 },
  modalTitle:  { fontSize: 16, fontWeight: '600', marginBottom: 14 },

  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    fontSize: 15,
    marginBottom: 20, // overridden when in passwordRow
  },

  passwordRow: {                    /* ← new */
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  eyeBtn: {                         /* ← new */
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderLeftWidth: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },

  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  primaryBtn:  { backgroundColor: '#0077ff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  primaryBtnPressed:{ opacity: 0.8 },
  primaryBtnText:{ color: '#fff', fontWeight: '600' },
  secondaryBtn:{ paddingVertical: 10, paddingHorizontal: 16 },
  secondaryBtnText:{ color: '#0077ff', fontWeight: '600' },
  
	helpOverlay: {
	  flex: 1,
	  justifyContent: 'center',
	  alignItems: 'center',
	  backgroundColor: 'rgba(0,0,0,0.5)',
	},
	helpCard: {
	  width: '80%',
	  backgroundColor: '#fff',
	  borderRadius: 12,
	  padding: 20,
	  elevation: 4,
	},
	helpTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
	helpBody: { fontSize: 14, marginBottom: 16 },
	helpLink: { color: '#0077ff', textDecorationLine: 'underline' },
	helpCloseBtn: {
	  alignSelf: 'flex-end',
	  paddingVertical: 6,
	  paddingHorizontal: 12,
	},
	helpCloseTxt: { color: '#0077ff', fontWeight: '600' },
  
  
});
