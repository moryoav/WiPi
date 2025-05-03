// src/lib/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

/* ─── keys ─── */
const PIS_KEY = 'PI_LIST';                               // list of Pi metadata
const credKey = (id, field) => `pi_${id}_${field}`;      // username|password|apikey
const locKey  = (id)        => `pi_${id}_locations`;     // travel history array

/* ─── credentials ─── */
export async function savePiCreds(id, user, pass, apiKey = '') {
  await SecureStore.setItemAsync(credKey(id, 'username'), user);
  await SecureStore.setItemAsync(credKey(id, 'password'), pass);
  await SecureStore.setItemAsync(credKey(id, 'apikey'),   apiKey);
}
export async function getPiCreds(id) {
  const username = await SecureStore.getItemAsync(credKey(id, 'username'));
  const password = await SecureStore.getItemAsync(credKey(id, 'password'));
  const apiKey   = await SecureStore.getItemAsync(credKey(id, 'apikey'));
  return { username, password, apiKey };
}
export async function deletePiCreds(id) {
  await SecureStore.deleteItemAsync(credKey(id, 'username'));
  await SecureStore.deleteItemAsync(credKey(id, 'password'));
  await SecureStore.deleteItemAsync(credKey(id, 'apikey'));
}

/* ─── travel history ─── */
export async function getPiLocations(id) {
  const json = await AsyncStorage.getItem(locKey(id));
  return json ? JSON.parse(json) : [];
}
export async function addPiLocation(id, locObj) {
  const list = await getPiLocations(id);
  list.push(locObj);
  await AsyncStorage.setItem(locKey(id), JSON.stringify(list));
}

/* ─── Pi list CRUD ─── */
export async function loadPis() {
  const json = await AsyncStorage.getItem(PIS_KEY);
  return json ? JSON.parse(json) : [];
}
async function savePis(pis) {
  await AsyncStorage.setItem(PIS_KEY, JSON.stringify(pis));
}

export async function addPi({ name, host, username, password, apiKey }) {
  const id   = uuidv4();
  const list = await loadPis();
  list.push({ id, name, host });
  await savePis(list);
  await savePiCreds(id, username, password, apiKey);
  return id;
}
export async function removePi(id) {
  const list = (await loadPis()).filter((pi) => pi.id !== id);
  await savePis(list);
  await deletePiCreds(id);
}
export async function updatePi({ id, name, host, username, password, apiKey }) {
  const list = await loadPis();
  const idx  = list.findIndex((pi) => pi.id === id);
  if (idx === -1) throw new Error('Pi not found');
  list[idx] = { id, name, host };
  await savePis(list);
  await savePiCreds(id, username, password, apiKey);
}
