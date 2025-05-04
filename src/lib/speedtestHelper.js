// src/lib/speedtestHelper.js

/**
 * Trigger an on-demand speed test via the Prometheus exporter
 * running at port 9798 on the Pi, then parse and convert metrics.
 *
 * @param {string} host  – the Pi’s hostname or IP (no port)
 * @returns {Promise<{ download: number, upload: number, ping: number }>}
 */
export async function runSpeedTest(host) {
  const url = `http://${host}:9798/metrics`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Speedtest HTTP error: ${res.status}`);
  }
  const text = await res.text();
  let downloadBits, uploadBits, pingMs;

  text.split('\n').forEach((line) => {
    if (line.startsWith('speedtest_download_bits_per_second ')) {
      downloadBits = parseFloat(line.split(' ')[1]);
    }
    if (line.startsWith('speedtest_upload_bits_per_second ')) {
      uploadBits = parseFloat(line.split(' ')[1]);
    }
    if (line.startsWith('speedtest_ping_latency_milliseconds ')) {
      // use ping for your 3-column row
      pingMs = parseFloat(line.split(' ')[1]);
    }
  });

  if (
    downloadBits == null ||
    uploadBits   == null ||
    pingMs       == null
  ) {
    throw new Error('Failed to parse all speedtest metrics');
  }

  return {
    download: downloadBits / 1e6,   // Mbps
    upload:   uploadBits   / 1e6,   // Mbps
    ping:     pingMs,              // ms
  };
}
