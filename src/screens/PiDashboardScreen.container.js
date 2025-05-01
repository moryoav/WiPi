// src/screens/PiDashboardScreen.container.js

import React, { useState, useEffect, useCallback } from 'react';
import { Pressable, View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { runSSH } from '../lib/sshClient';

import PiDashboardScreenView from '../components/PiDashboardScreen.view';
import { useNetworks } from '../hooks/useNetworks';

export default function PiDashboardScreenContainer({ navigation, route }) {
  const { id, hostname, host } = route.params;

  const {
	initializing,  
    creds,        // null until loaded
    curr,
    known,
    scan,
    scanning,     // whether a scan is in progress
    refresh,
    scanNetworks, // function to trigger a scan
    connect,
    forget,
    connectNew,
  } = useNetworks(id, host);

  //const credsLoaded = creds !== null;

  // Local modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSsid, setModalSsid]       = useState('');
  const [modalPsk, setModalPsk]         = useState('');

  const [connectingId, setConnectingId] = useState(null);

  const handleConnect = async (id) => {
    setConnectingId(id);          // show loader for this network
    try {
      await connect(id);          // run the existing hook function
    } finally {
      setConnectingId(null);      // hide loader when done
    }
  };

  const showModal = (ssid) => {
    setModalSsid(ssid);
    setModalPsk('');
    setModalVisible(true);
  };
  const hideModal = () => setModalVisible(false);

  // Show full-screen loader until credentials are loaded
  if (initializing) {
    console.log('Showing loader - creds not loaded yet');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PiDashboardScreenView
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
      showModal={showModal}
      hideModal={hideModal}
      onChangeModalPsk={setModalPsk}
    />
  );
}
