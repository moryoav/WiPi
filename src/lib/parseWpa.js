// Parse `wpa_cli -i wlan2 status`
export function parseStatus(text) {
  const obj = {};
  text.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) obj[k.trim()] = v.trim();
  });
  return obj; // {ssid, ip_address, wpa_state, ...}
}

// Parse `wpa_cli -i wlan2 list_networks`
export function parseNetworks(text) {
  const rows = text.trim().split('\n');
  rows.shift();               // remove header
  return rows.map(r => {
    const [id, ssid, bssid, flags] = r.split('\t');
    return { id, ssid, selected: flags.includes('[CURRENT]') };
  });
}
