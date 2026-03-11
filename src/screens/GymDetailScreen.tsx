import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { gymApi } from '../services/api';
import { Gym } from '../types';
import { GroupsStackParamList, MapStackParamList } from '../types';

type GymDetailRouteProp = RouteProp<GroupsStackParamList & MapStackParamList, 'GymDetail'>;

const GymDetailScreen: React.FC = () => {
  const route = useRoute<GymDetailRouteProp>();
  const { gymId } = route.params;
  const { gyms, friends, presence } = useApp();
  const [gym, setGym] = useState<Gym | null>(gyms.find((g) => g.id === gymId) ?? null);
  const [loading, setLoading] = useState(!gym);

  useEffect(() => {
    if (gym) return;
    let cancelled = false;
    gymApi
      .getGymById(gymId)
      .then((g) => {
        if (!cancelled) setGym(g);
      })
      .catch(() => {
        if (!cancelled) Alert.alert('Error', 'Failed to load gym');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gymId, gym]);

  const friendIds = new Set(friends.map((f) => f.id));
  const friendsHere = presence.filter(
    (p) => p.gymId === gymId && p.isActive && friendIds.has(p.userId)
  );
  const friendNames = friendsHere.map((p) => friends.find((f) => f.id === p.userId)?.name ?? 'Friend');

  if (loading || !gym) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.gymName}>{gym.name}</Text>
        {gym.address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={18} color="#8E8E93" />
            <Text style={styles.address}>{gym.address}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends here now</Text>
        {friendNames.length > 0 ? (
          <View style={styles.friendsList}>
            {friendNames.map((name, i) => (
              <View key={i} style={styles.friendRow}>
                <Ionicons name="person" size={16} color="#34C759" />
                <Text style={styles.friendName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noFriends}>No friends at this gym right now</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  gymName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  address: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  friendsList: {
    gap: 8,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  friendName: {
    fontSize: 15,
    color: '#000',
  },
  noFriends: {
    fontSize: 15,
    color: '#8E8E93',
  },
});

export default GymDetailScreen;
