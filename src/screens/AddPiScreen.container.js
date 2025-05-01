import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { addPi, updatePi } from '../lib/storage';
import AddPiScreenView from '../components/AddPiScreen.view';

export default function AddPiScreenContainer({ navigation, route }) {
  /* if route.params.pi exists, we’re editing */
  const editingPi = route.params?.pi ?? null;

  const [name, setName]         = useState(editingPi?.name ?? '');
  const [host, setHost]         = useState(editingPi?.host ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving]     = useState(false);

  /* load creds when editing so fields are filled */
  useEffect(() => {
    (async () => {
      if (!editingPi) return;
      const { getPiCreds } = await import('../lib/storage');
      const creds = await getPiCreds(editingPi.id);
      setUsername(creds.username ?? '');
      setPassword(creds.password ?? '');
    })();
  }, [editingPi]);

  const onSave = async () => {
    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      Alert.alert('Validation error', 'All fields are required.');
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
        });
      } else {
        await addPi({
          name: name.trim(),
          host: host.trim(),
          username: username.trim(),
          password,
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Unable to save Pi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AddPiScreenView
      name={name}
      host={host}
      username={username}
      password={password}
      saving={saving}
      onChangeName={setName}
      onChangeHost={setHost}
      onChangeUsername={setUsername}
      onChangePassword={setPassword}
      onSave={onSave}
    />
  );
}
