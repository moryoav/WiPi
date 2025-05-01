// src/lib/storage.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

// Key under which the Pi metadata list is stored in AsyncStorage
const PIS_KEY = 'PI_LIST';

/** 
 * Helper to build a valid SecureStore key.
 * UUIDs may include hyphens (allowed), but we replace colons with underscores.
 */
function credKey(id, field) {
  // e.g. "pi_<uuid>_username" or "pi_<uuid>_password"
  return `pi_${id}_${field}`;
}

/**
 * Save username/password under a per-Pi key in SecureStore
 */
export async function savePiCreds(id, username, password) {
  await SecureStore.setItemAsync(credKey(id, 'username'), username);
  await SecureStore.setItemAsync(credKey(id, 'password'), password);
}

/**
 * Retrieve credentials for a given Pi id
 */
export async function getPiCreds(id) {
  const username = await SecureStore.getItemAsync(credKey(id, 'username'));
  const password = await SecureStore.getItemAsync(credKey(id, 'password'));
  return { username, password };
}

/**
 * Delete stored credentials for a given Pi id
 */
export async function deletePiCreds(id) {
  await SecureStore.deleteItemAsync(credKey(id, 'username'));
  await SecureStore.deleteItemAsync(credKey(id, 'password'));
}

/**
 * Load the array of saved Pis ({id,name,host})
 */
export async function loadPis() {
  const json = await AsyncStorage.getItem(PIS_KEY);
  return json ? JSON.parse(json) : [];
}

/**
 * Save the array of Pis back to AsyncStorage
 */
async function savePis(pis) {
  await AsyncStorage.setItem(PIS_KEY, JSON.stringify(pis));
}

/**
 * Add a new Pi.
 * - name: friendly hostname
 * - host: IP or host
 * - username: SSH user
 * - password: SSH password
 */
export async function addPi({ name, host, username, password }) {
  const id = uuidv4();

  // 1) Save metadata
  const list = await loadPis();
  list.push({ id, name, host });
  await savePis(list);

  // 2) Securely save creds
  await savePiCreds(id, username, password);

  return id;
}

/**
 * Remove a Pi by its id (also deletes its stored password)
 */
export async function removePi(id) {
  // 1) Metadata
  const list = (await loadPis()).filter(pi => pi.id !== id);
  await savePis(list);

  // 2) Credentials
  await deletePiCreds(id);
}

/**
 * Update an existing Pi by id.
 * Also overwrites its stored credentials.
 */
export async function updatePi({ id, name, host, username, password }) {
  const list = await loadPis();
  const idx  = list.findIndex((pi) => pi.id === id);
  if (idx === -1) throw new Error('Pi not found');

  // 1) update metadata
  list[idx] = { id, name, host };
  await savePis(list);

  // 2) update credentials
  await savePiCreds(id, username, password);
}