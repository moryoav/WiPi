// src/screens/PiDashboardScreen.container.js
import React, { useState } from 'react';
// ★ REMOVED: useEffect/useCallback  – not needed for this file now
import { View } from 'react-native';

import PiDashboardScreenView from '../components/PiDashboardScreen.view';
import { useNetworks }        from '../hooks/useNetworks';

export default function PiDashboardScreenContainer({ navigation, route }) {
  const { id, hostname, host } = route.params;

  const {
    initialLoading,   // ★ ADDED – new flag from hook
    creds,            // (still exposed, might be useful later)
    curr,
    known,
    scan,
    scanning,
    refresh,
    scanNetworks,
    connect,
    forget,
    connectNew,
  } = useNetworks(id, host);

  /* local modal state */
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSsid, setModalSsid]       = useState('');
  const [modalPsk,  setModalPsk]        = useState('');
  const [connectingId, setConnectingId] = useState(null);

  const handleConnect = async (netId) => {
    setConnectingId(netId);
    try { await connect(netId); }
    finally { setConnectingId(null); }
  };

  return (
    /* we no longer hide the whole screen – instead pass a loading flag */
    <PiDashboardScreenView
      initialLoading={initialLoading}     // ★ ADDED
      hostname={hostname}
      curr={curr}
      known={known}
      scan={scan}
      scanning={scanning}
      connectingId={connectingId}
      modalVisible={modalVisible}
      modalSsid={modalSsid}
      modalPsk={modalPsk}
      onScan={scanNetworks}
      onConnect={handleConnect}
      onForget={forget}
      onConnectNew={connectNew}
      showModal={(ssid) => { setModalSsid(ssid); setModalPsk(''); setModalVisible(true); }}
      hideModal={() => setModalVisible(false)}
      onChangeModalPsk={setModalPsk}
    />
  );
}
