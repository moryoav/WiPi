import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

export default function PiListScreenView({
  pis,
  reachable,
  onSelect,
  onDelete,
  onAdd,
  onEdit,          // NEW
}) {
  const confirmDelete = (item) => {
    Alert.alert(
      'Delete Pi',
      `Remove "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(item.id),
        },
      ],
    );
  };

  const renderItem = ({ item }) => {
    const isReachable = reachable[item.id];

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isReachable ? styles.cardReachable : styles.cardUnreachable,
          pressed && isReachable && styles.cardPressed,
        ]}
        android_ripple={isReachable ? { color: 'rgba(0,0,0,0.05)' } : undefined}
        onPress={isReachable ? () => onSelect(item) : null}
        onLongPress={() => confirmDelete(item)}
        disabled={!isReachable}
      >
        {/* row: text column + icon column */}
        <View style={styles.cardRow}>
          {/* LEFT – status + texts */}
          <View style={styles.textCol}>
            <View style={styles.nameRow}>
              <MaterialIcons
                name={isReachable ? 'wifi' : 'wifi-off'}
                size={18}
                color={isReachable ? '#4caf50' : '#9e9e9e'}
                style={styles.statusIcon}
              />
              <Text style={[styles.name, !isReachable && { color: '#9e9e9e' }]}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.host}>{item.host}</Text>
          </View>

          {/* RIGHT – edit + delete */}
          <View style={styles.iconCol}>
            <Pressable
              hitSlop={12}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
              onPress={() => onEdit(item)}
            >
              <MaterialIcons name="edit" size={28} color="#4caf50" />
            </Pressable>

            <Pressable
              hitSlop={12}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => confirmDelete(item)}
            >
              <MaterialIcons name="delete" size={32} color="#f44336" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pis}
        keyExtractor={(pi) => pi.id}
        renderItem={renderItem}
        contentContainerStyle={[
          { flexGrow: 1 },
          !pis.length && { justifyContent: 'center' },
        ]}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No Pis yet. Tap the + button to add your first Pi.
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
        onPress={onAdd}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </View>
  );
}

const CARD_RADIUS = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardReachable: { borderLeftWidth: 4, borderLeftColor: '#4caf50' },
  cardUnreachable: { borderLeftWidth: 4, borderLeftColor: '#9e9e9e' },
  cardPressed: { transform: [{ scale: 0.99 }] },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  textCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusIcon: { marginRight: 6 },
  name: { fontSize: 16, fontWeight: '600', color: '#212121' },
  host: { fontSize: 12, color: '#616161' },

  iconCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: { marginLeft: 8 },

  empty: { textAlign: 'center', fontSize: 14, color: '#9e9e9e' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
