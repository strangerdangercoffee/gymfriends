import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { userAreaVisitsApi } from '../services/api';
import { ClimbingArea } from '../types';
import { GroupsStackParamList, MapStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';

type AreasMapNav =
  | StackNavigationProp<GroupsStackParamList, 'AreasMap'>
  | StackNavigationProp<MapStackParamList, 'MapMain'>;

const DEFAULT_REGION = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

const AreasMapScreen: React.FC = () => {
  const navigation = useNavigation<AreasMapNav>();
  const { user } = useAuth();
  const { climbingAreas, friends } = useApp();
  const [presence, setPresence] = useState<{ areaId: string; userId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ClimbingArea | null>(null);

  const friendsByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of presence) {
      const list = map.get(p.areaId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.areaId, list);
    }
    return map;
  }, [presence]);

  const friendName = (userId: string): string => {
    const f = friends.find((x) => x.id === userId);
    return f?.name ?? 'Friend';
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const api = __DEV__
      ? userAreaVisitsApi.getFriendsPresenceForUserWithTripTest(user.id)
      : userAreaVisitsApi.getFriendsPresenceForUser(user.id);
    api
      .then((data) => {
        if (!cancelled) setPresence(data);
      })
      .catch(() => {
        if (!cancelled) setPresence([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleViewArea = (areaId: string) => {
    setSelectedArea(null);
    (navigation as { navigate: (name: 'AreaDetail', params: { areaId: string }) => void }).navigate(
      'AreaDetail',
      { areaId }
    );
  };

  const friendIdsForArea = selectedArea ? (friendsByArea.get(selectedArea.id) ?? []) : [];

  if (loading && climbingAreas.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        <Text style={styles.headerTitle}>Map</Text>
        <View style={styles.placeholder} />
      </View>
      <MapView
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={false}
      >
        {climbingAreas.map((area: ClimbingArea) => {
          const friendIds = friendsByArea.get(area.id) ?? [];
          const hasFriends = friendIds.length > 0;
          return (
            <Marker
              key={area.id}
              coordinate={{
                latitude: area.latitude,
                longitude: area.longitude,
              }}
              pinColor={hasFriends ? '#34C759' : '#007AFF'}
              onPress={() => setSelectedArea(area)}
            />
          );
        })}
      </MapView>

      <Modal
        visible={selectedArea !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedArea(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedArea(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedArea && (
              <>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {selectedArea.name}
                </Text>
                {friendIdsForArea.length > 0 ? (
                  <Text style={styles.calloutFriends}>
                    {friendIdsForArea.length === 1
                      ? `1 friend here: ${friendName(friendIdsForArea[0])}`
                      : `${friendIdsForArea.length} friends here: ${friendIdsForArea.map(friendName).join(', ')}`}
                  </Text>
                ) : (
                  <Text style={styles.calloutSub}>No friends at this area</Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewAreaButton}
                    onPress={() => handleViewArea(selectedArea.id)}
                  >
                    <Text style={styles.viewAreaButtonText}>View area</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedArea(null)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 32,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  calloutFriends: {
    fontSize: 14,
    color: '#3C3C43',
    marginBottom: 8,
  },
  calloutSub: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  viewAreaButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewAreaButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    minWidth: 280,
    maxWidth: 320,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#8E8E93',
  },
});

export default AreasMapScreen;
