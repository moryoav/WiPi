// src/components/AddPiScreen.view.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Linking,                  // ← add
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // eye + help icons

/**
 * Modern-UI “Add Pi” form with SHOW-PASSWORD toggle + optional API Key
 */
export default function AddPiScreenView({
  name,
  host,
  username,
  password,
  apiKey,
  allowGeo,
  saving,
  onChangeName,
  onChangeHost,
  onChangeUsername,
  onChangePassword,
  onChangeApiKey,
  onToggleGeo,
  onSave,
}) {
  const [showPassword, setShowPassword] = useState(false);

  /* open docs / REST config in external browser */
	const openRestApiConf = () => {
	  const h = host.trim() || '10.3.141.1';   // fallback to default IP
	  Linking.openURL(`http://${h}/restapi_conf`).catch(() => {});
	};

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={64}
      >
        <ScrollView contentContainerStyle={styles.inner} bounces={false}>
          <Field
            label="Friendly Name"
            placeholder="e.g. raspap.local"
            value={name}
            onChangeText={onChangeName}
            editable={!saving}
          />

          <Field
            label="Host / IP"
            placeholder="e.g. 10.4.141.1"
            value={host}
            onChangeText={onChangeHost}
            editable={!saving}
            keyboardType="url"
            autoCapitalize="none"
          />

          <Field
            label="SSH Username"
            placeholder="e.g. pi"
            value={username}
            onChangeText={onChangeUsername}
            editable={!saving}
            autoCapitalize="none"
          />

          {/* SSH password with eye icon */}
          <View style={styles.field}>
            <Text style={styles.label}>SSH Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••"
                value={password}
                onChangeText={onChangePassword}
                editable={!saving}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                disabled={saving}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* API Key row with help icon */}
          <View style={styles.field}>
            <Text style={styles.label}>RaspAP API Key (optional)</Text>
            <View style={styles.apiRow}>
              <TextInput
                style={[styles.input, styles.apiInput]}
                placeholder="Paste API Key…"
                value={apiKey}
                onChangeText={onChangeApiKey}
                editable={!saving}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={openRestApiConf}
                disabled={saving}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons name="help-circle-outline" size={24} color="#0077ff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── NEW: Allow Geolocation switch ─────────────────── */}
          <View style={[styles.field, styles.switchRow]}>
            <Text style={styles.label}>Allow Geolocation</Text>
            <Switch
              value={allowGeo}
              onValueChange={onToggleGeo}
              disabled={saving}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={onSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Pi</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* reusable labelled input */
function Field({ label, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...inputProps} />
    </View>
  );
}

/* styles */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  inner: { padding: 24 },

  field: { marginBottom: 24 },
  label: { marginBottom: 6, fontWeight: '600', fontSize: 15, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },

  /* password row */
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { paddingHorizontal: 10 },

  /* API Key row */
  apiRow: { flexDirection: 'row', alignItems: 'center' },
  apiInput: { flex: 1 },
  helpBtn: { paddingHorizontal: 10 },

  /* button */
  saveBtn: {
    marginTop: 12,
    backgroundColor: '#0077ff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
