// src/lib/storage.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

// Key under which the Pi metadata list is stored in AsyncStorage
const PIS_KEY = 'PI_LIST';

/** 
 * Helper to build a valid SecureStore key.
 * UUIDs may include hyphens (allowed), but we replace colons with underscores.
 * Field can be username | password | apikey
 */
function credKey(id, field) {
  return `pi_${id}_${field}`;
}

/**
 * Save username/password/[apiKey] under a per-Pi key in SecureStore
 */
export async function savePiCreds(id, username, password, apiKey = '') { // MOD
  await SecureStore.setItemAsync(credKey(id, 'username'), username);
  await SecureStore.setItemAsync(credKey(id, 'password'), password);
  await SecureStore.setItemAsync(credKey(id, 'apikey'),  apiKey);        // ADD
}

/**
 * Retrieve credentials for a given Pi id
 */
export async function getPiCreds(id) {
  const username = await SecureStore.getItemAsync(credKey(id, 'username'));
  const password = await SecureStore.getItemAsync(credKey(id, 'password'));
  const apiKey   = await SecureStore.getItemAsync(credKey(id, 'apikey')); // ADD
  return { username, password, apiKey };                                   // MOD
}

/**
 * Delete stored credentials for a given Pi id
 */
export async function deletePiCreds(id) {
  await SecureStore.deleteItemAsync(credKey(id, 'username'));
  await SecureStore.deleteItemAsync(credKey(id, 'password'));
  await SecureStore.deleteItemAsync(credKey(id, 'apikey'));               // ADD
}

/**
 * Load the array of saved Pis ({id,name,host})
 */
export async function loadPis() {
  const json = await AsyncStorage.getItem(PIS_KEY);
  return json ? JSON.parse(json) : [];
}

/* internal */
async function savePis(pis) {
  await AsyncStorage.setItem(PIS_KEY, JSON.stringify(pis));
}

/**
 * Add a new Pi.
 */
export async function addPi({ name, host, username, password, apiKey }) { // MOD
  const id = uuidv4();

  // 1) Save metadata
  const list = await loadPis();
  list.push({ id, name, host });
  await savePis(list);

  // 2) Securely save creds
  await savePiCreds(id, username, password, apiKey);                      // MOD

  return id;
}

/**
 * Remove a Pi by its id
 */
export async function removePi(id) {
  const list = (await loadPis()).filter(pi => pi.id !== id);
  await savePis(list);
  await deletePiCreds(id);
}

/**
 * Update an existing Pi by id.
 */
export async function updatePi({ id, name, host, username, password, apiKey }) { // MOD
  const list = await loadPis();
  const idx  = list.findIndex((pi) => pi.id === id);
  if (idx === -1) throw new Error('Pi not found');

  // 1) update metadata
  list[idx] = { id, name, host };
  await savePis(list);

  // 2) update credentials
  await savePiCreds(id, username, password, apiKey);                      // MOD
}
