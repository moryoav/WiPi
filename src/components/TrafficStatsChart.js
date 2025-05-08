// src/components/TrafficStatsChart.js

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePiTrafficStats } from '../hooks/usePiTrafficStats';

const BAR_WIDTH = 10;
const CHART_HEIGHT = 30; // reduced height for compact view

export default function TrafficStatsChart({
  piId,
  host,
  period = 'daily', // 'daily' | 'monthly' | 'hourly'
}) {
  const { loading, dailyStats, monthlyStats, hourlyStats } =
    usePiTrafficStats(piId, host);
  if (loading) return null;

  const statsObj =
    period === 'monthly'
      ? monthlyStats
      : period === 'hourly'
      ? hourlyStats
      : dailyStats;

  if (
    !statsObj ||
    !Array.isArray(statsObj.interfaces) ||
    statsObj.interfaces.length === 0
  ) {
    return null;
  }

  const iface = statsObj.interfaces[0];
  let entries = [];

  if (period === 'monthly') {
    entries = iface.traffic.month || [];
  } else if (period === 'hourly') {
    entries = iface.traffic.fiveminute || [];
  } else {
    entries = iface.traffic.day || [];
  }

  const count = period === 'monthly' ? 12 : period === 'hourly' ? 24 : 7;
  const recent = entries.slice(-count);
  if (recent.length === 0) return null;

  const labels = recent.map(item => {
    if (period === 'hourly') {
      const h = String(item.time.hour).padStart(2, '0');
      const m = String(item.time.minute).padStart(2, '0');
      return `${h}:${m}`;
    }
    if (period === 'monthly') {
      return String(item.date.month).padStart(2, '0');
    }
    const mm = String(item.date.month).padStart(2, '0');
    const dd = String(item.date.day).padStart(2, '0');
    return `${mm}-${dd}`;
  });

  const data = recent.map(item => item.rx / 1024 / 1024);
  const maxValue = Math.max(...data);

  return (
    <View style={styles.container}>
      {/* Title row */}
      <View style={styles.headerRow}>
        <MaterialIcons
          name="bar-chart"
          size={18}
          color="#4caf50"
          style={styles.headerIcon}
        />
        <Text style={styles.headerText}>
          {period.charAt(0).toUpperCase() + period.slice(1)} Traffic (MiB)
        </Text>
      </View>

      {/* Chart row */}
      <View style={styles.chartRow}>
        {data.map((value, idx) => {
          const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <View key={idx} style={styles.barContainer}>
              <View style={[styles.bar, { height: `${heightPct}%` }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
    alignItems: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginBottom: 4,
  },
  headerIcon: {
    marginRight: 6,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingHorizontal: 4,
    // no overflow hidden so top radius always visible
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: BAR_WIDTH,
    backgroundColor: '#4caf50',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    // ensure consistent rounding
  },
});
