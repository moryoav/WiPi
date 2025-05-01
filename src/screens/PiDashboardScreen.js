import React, {
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  SectionList,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
} from 'react-native';
import { runSSH } from '../lib/sshClient';
import { getPiCreds } from '../lib/storage';

/** Parse `wpa_cli status` into { key: value } */
function parseStatus(text) {
  const obj = {};
  text.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      obj[key] = val;
    }
  });
  return obj;
}

/** Parse `wpa_cli list_networks` into [{ id, ssid, selected }] */
function parseNetworks(text) {
  if (!text) return [];
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length <= 1) return [];
  return lines.slice(1).map(line => {
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

export default function PiDashboardScreen({ route }) {
  const { id, hostname, host } = route.params;

  // -- load SSH creds from SecureStore --
  const [creds, setCreds] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const c = await getPiCreds(id);
        setCreds({ host, ...c });
      } catch (e) {
        console.warn('Failed to load credentials:', e);
      }
    })();
  }, [id, host]);

  // -- state for networks & modal --
  const [curr, setCurr]   = useState(null);
  const [known, setKnown] = useState([]);
  const [scan, setScan]   = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalSsid, setModalSsid]       = useState('');
  const [modalPsk, setModalPsk]         = useState('');

  /** Run multiple commands in one SSH session. Retry on reset. */
  const runPipeline = useCallback(
    async (cmds) => {
      if (!creds) throw new Error('No SSH creds yet');
      const pipeline = cmds.join(' && ');
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await runSSH({
            ...creds,
            command: `bash -lc "${pipeline}"`,
          });
        } catch (err) {
          if (attempt === 1 && /Connection reset/.test(err.message)) {
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          throw err;
        }
      }
    },
    [creds]
  );

  /** Refresh current + known networks */
  const refresh = useCallback(async () => {
    if (!creds) return;
    try {
      const out = await runPipeline([
        '/sbin/wpa_cli -i wlan2 status',
        'echo "__SPLIT__"',
        '/sbin/wpa_cli -i wlan2 list_networks',
      ]);
      const [statusTxt, netsTxt] = out.split('__SPLIT__');
      setCurr(parseStatus(statusTxt));
      setKnown(parseNetworks(netsTxt));
    } catch (e) {
      console.warn('refresh error', e);
      setCurr(null);
      setKnown([]);
    }
  }, [creds, runPipeline]);

  // initial load once creds are present
  useEffect(() => {
    refresh();
  }, [creds, refresh]);

  // Add periodic refresh
  useEffect(() => {
    if (!creds) return;
    const interval = setInterval(refresh, 15000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [creds, refresh]);

  /** Scan for new networks, dedupe & filter */
  const handleScan = async () => {
    if (!creds) return;
    setScan([]);
    try {
      const out = await runPipeline([
        '/sbin/wpa_cli -i wlan2 scan',
        'sleep 2',
        '/sbin/wpa_cli -i wlan2 scan_results',
      ]);

      // exclude AP SSIDs
      let apSsids = [];
      try {
        const apTxt = await runPipeline([
          `grep -h '^ssid=' /etc/hostapd/*.conf | cut -d= -f2`,
        ]);
        apSsids = apTxt.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
      } catch {}

      const exclude = new Set([
        ...known.map(n => n.ssid.toLowerCase()),
        (curr?.ssid || '').toLowerCase(),
        ...apSsids,
      ]);

      const rows = out.trim().split('\n').slice(1);
      const bySsid = new Map();
      rows.forEach(line => {
        const cols = line.split('\t');
        const ssid = (cols[4] || '').trim();
        const signal = parseInt(cols[2], 10);
        if (!ssid) return;
        const key = ssid.toLowerCase();
        if (exclude.has(key)) return;
        const prev = bySsid.get(key);
        if (!prev || signal > prev.signal) {
          bySsid.set(key, { ssid, signal });
        }
      });

      setScan(Array.from(bySsid.values()).sort((a, b) => b.signal - a.signal));
    } catch (e) {
      console.warn('scan_results error', e);
    }
  };

  /** Select existing network */
  const handleConnect = async (nid) => {
    await runPipeline([`/sbin/wpa_cli -i wlan2 select_network ${nid}`]);
    await new Promise(resolve => setTimeout(resolve, 3000));
    refresh();
  };

  /** Forget existing network */
  const handleForget = async (nid) => {
    await runPipeline([
      `/sbin/wpa_cli -i wlan2 remove_network ${nid}`,
      `/sbin/wpa_cli -i wlan2 save_config`,
    ]);
    refresh();
  };

  /** Add & connect to brand‐new SSID */
  const handleConnectNew = async (ssid, psk = '') => {
    try {
      // 1) add
      const addOut = await runSSH({
        ...creds,
        command: '/sbin/wpa_cli -i wlan2 add_network',
      });
      const netId = addOut.trim();

      // 2) configure + select + save
      const pipeline = [
        `/sbin/wpa_cli -i wlan2 set_network ${netId} ssid '"${ssid}"'`,
        psk
          ? `/sbin/wpa_cli -i wlan2 set_network ${netId} psk '"${psk}"'`
          : `/sbin/wpa_cli -i wlan2 set_network ${netId} key_mgmt NONE`,
        `/sbin/wpa_cli -i wlan2 enable_network ${netId}`,
        `/sbin/wpa_cli -i wlan2 select_network ${netId}`,
        `/sbin/wpa_cli -i wlan2 save_config`,
      ].join(' && ');

      await runSSH({ ...creds, command: pipeline });
    } catch (e) {
      console.warn('Error connecting new:', e);
    } finally {
      setTimeout(refresh, 1000);
      setScan([]);
    }
  };

  // while creds are loading
  if (!creds) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  return (
    <>
      <SectionList
        sections={[
          {
            title: 'Known networks',
            data: known,
            renderItem: ({ item }) => (
              <View style={{ padding:12, borderBottomWidth:0.5 }}>
                <Text>{item.ssid || '(hidden)'}</Text>
                {item.selected && (
                  <Text style={{ fontSize:12, color:'green' }}>
                    CURRENT
                  </Text>
                )}
                <View style={{ flexDirection:'row', marginTop:4 }}>
                  <TouchableOpacity
                    onPress={() => handleConnect(item.id)}
                    style={{ marginRight:12 }}
                  >
                    <Text style={{ color:'blue' }}>Connect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleForget(item.id)}>
                    <Text style={{ color:'red' }}>Forget</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ),
          },
          {
            title: 'New networks',
            data: scan,
            renderItem: ({ item }) => (
              <TouchableOpacity
                style={{ padding:12, borderBottomWidth:0.5 }}
                onPress={() => {
                  setModalSsid(item.ssid);
                  setModalPsk('');
                  setModalVisible(true);
                }}
              >
                <Text>{item.ssid}</Text>
                <Text style={{ fontSize:12 }}>Signal {item.signal}</Text>
              </TouchableOpacity>
            ),
          },
        ]}
        keyExtractor={(item, idx) => item.ssid + idx}
        ListHeaderComponent={
          <View style={{ padding:16 }}>
            <Text style={{ fontWeight:'bold', marginBottom:8 }}>
              {hostname}
            </Text>
            {curr?.ssid && (
              <>
                <Text style={{ fontSize:12, color:'#888' }}>
                  Current connection
                </Text>
                <View style={{ padding:12, borderWidth:0.5, marginBottom:16 }}>
                  <Text>{curr.ssid}</Text>
                </View>
              </>
            )}
            <TouchableOpacity
              onPress={handleScan}
              style={{
                padding:12,
                borderWidth:0.5,
                backgroundColor:'#eee',
                alignItems:'center',
                marginBottom:12,
              }}
            >
              <Text>🔍 Scan for new networks</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{
            paddingLeft:16,
            paddingTop:8,
            fontSize:12,
            color:'#888'
          }}>
            {title}
          </Text>
        )}
        stickySectionHeadersEnabled={false}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex:1,
          justifyContent:'center',
          alignItems:'center',
          backgroundColor:'rgba(0,0,0,0.5)'
        }}>
          <View style={{
            width:'80%',
            padding:16,
            backgroundColor:'#fff',
            borderRadius:8
          }}>
            <Text style={{ marginBottom:8 }}>
              Connect to "{modalSsid}"
            </Text>
            <TextInput
              placeholder="Password (leave blank if open)"
              secureTextEntry
              value={modalPsk}
              onChangeText={setModalPsk}
              style={{
                borderWidth:0.5,
                borderColor:'#ccc',
                padding:8,
                marginBottom:16,
                borderRadius:4
              }}
            />
            <Button
              title="Connect"
              onPress={async () => {
                await handleConnectNew(modalSsid, modalPsk);
                setModalVisible(false);
              }}
            />
            <View style={{ height:8 }} />
            <Button
              title="Cancel"
              color="gray"
              onPress={() => setModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
