import React, { useState, useEffect , useLayoutEffect } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { addPi, updatePi } from '../lib/storage';
import AddPiScreenView from '../components/AddPiScreen.view';

export default function AddPiScreenContainer({ navigation, route }) {
  /* if route.params.pi exists, we’re editing */
  const editingPi = route.params?.pi ?? null;

  const [name, setName]         = useState(editingPi?.name ?? '');
  const [host, setHost]         = useState(editingPi?.host ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey]     = useState('');               // ADD
  const [saving, setSaving]     = useState(false);
  const [allowGeo, setAllowGeo] = useState(false); 

  /* load creds when editing so fields are filled */
  useEffect(() => {
    (async () => {
      if (!editingPi) return;
      const { getPiCreds } = await import('../lib/storage');
      const creds = await getPiCreds(editingPi.id);
      setUsername(creds.username ?? '');
      setPassword(creds.password ?? '');
      setApiKey(creds.apiKey ?? '');                           // ADD
    })();
  }, [editingPi]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: editingPi ? 'Edit a Pi' : 'Add a Pi',
    });
  }, [navigation, editingPi]);

  /* check OS permission every time screen is shown */
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const ok = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
        setAllowGeo(ok);
      } else {
        // iOS – the Geolocation API itself gives the current status.
        // `requestAuthorization()` returns the previous state without prompting.
        const status = await navigator.geolocation.requestAuthorization();
        setAllowGeo(status === 'granted');
      }
    })();
  }, [route?.key]);       

  const onSave = async () => {
    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      Alert.alert('Validation error', 'All fields except API Key are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingPi) {
        await updatePi({
          id: editingPi.id,
          name: name.trim(),
          host: host.trim(),
          username: username.trim(),
          password,
          apiKey: apiKey.trim(),                               // ADD
        });
      } else {
        await addPi({
          name: name.trim(),
          host: host.trim(),
          username: username.trim(),
          password,
          apiKey: apiKey.trim(),                               // ADD
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Unable to save Pi.');
    } finally {
      setSaving(false);
    }
  };

  /* ---- handle toggle ------------------------------------------------ */
  const toggleGeo = async (value) => {
    if (!value) {
      // user disabled – just reflect it
      return setAllowGeo(false);
    }
    /* ask for permission */
    let granted = false;
    try {
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          {
            title: 'Location access',
            message:
              'Allow the app to access your approximate location for the tunnel map.',
            buttonPositive: 'OK',
          }
        );
        granted = res === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const s = await navigator.geolocation.requestAuthorization();
        granted = s === 'granted';
      }
   } catch { /* ignore */ }
    setAllowGeo(granted);
  };

  return (
    <AddPiScreenView
      name={name}
      host={host}
      username={username}
      password={password}
      apiKey={apiKey}                     /* ADD */
	  allowGeo={allowGeo} 
      saving={saving}
      onChangeName={setName}
      onChangeHost={setHost}
      onChangeUsername={setUsername}
      onChangePassword={setPassword}
      onChangeApiKey={setApiKey}          /* ADD */
	  onToggleGeo={toggleGeo} 
      onSave={onSave}
    />
  );
}
