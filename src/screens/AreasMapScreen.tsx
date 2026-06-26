import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useNetwork } from '../context/NetworkContext';
import { userAreaVisitsApi } from '../services/api';
import { ClimbingArea, Gym, FindStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors } from '../theme/colors';

type AreasMapNav = StackNavigationProp<FindStackParamList, 'AreasMap'>;

type MapMode = 'areas' | 'gyms';

type SearchHit =
  | { type: 'area'; id: string; name: string; latitude: number; longitude: number }
  | { type: 'gym'; id: string; name: string; latitude: number; longitude: number };

/** World view: max span so the full globe is visible (MapKit / Google Maps may clamp slightly). */
const DEFAULT_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 180,
  longitudeDelta: 360,
};

const FLY_REGION_DELTA = { latitudeDelta: 0.35, longitudeDelta: 0.35 };

/** Google Maps styling (Android; ignored on Apple Maps). Tuned to app palette. */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1A2B1E' }] },
  { elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C8E6D4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020C18' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#30362F' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A3D32' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9EB5A8' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F1F18' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5A7A6A' }] },
];

const AreasMapScreen: React.FC = () => {
  const navigation = useNavigation<AreasMapNav>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const { climbingAreas, gyms, friends, presence: gymPresence } = useApp();
  const [mapMode, setMapMode] = useState<MapMode>('areas');
  const [presence, setPresence] = useState<{ areaId: string; userId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ClimbingArea | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const friendsByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of presence) {
      const list = map.get(p.areaId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.areaId, list);
    }
    return map;
  }, [presence]);

  const friendsByGym = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of gymPresence) {
      if (!p.isActive || !friendIds.has(p.userId)) continue;
      const list = map.get(p.gymId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.gymId, list);
    }
    return map;
  }, [gymPresence, friendIds]);

  const gymsWithCoords = useMemo(
    () =>
      gyms.filter(
        (g) => typeof g.latitude === 'number' && typeof g.longitude === 'number'
      ),
    [gyms]
  );

  const searchIndex = useMemo((): SearchHit[] => {
    const areaHits: SearchHit[] = climbingAreas.map((a) => ({
      type: 'area',
      id: a.id,
      name: a.name,
      latitude: a.latitude,
      longitude: a.longitude,
    }));
    const gymHits: SearchHit[] = gymsWithCoords.map((g) => ({
      type: 'gym',
      id: g.id,
      name: g.name,
      latitude: g.latitude,
      longitude: g.longitude,
    }));
    return [...areaHits, ...gymHits].sort((a, b) => a.name.localeCompare(b.name));
  }, [climbingAreas, gymsWithCoords]);

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchIndex.slice(0, 40);
    return searchIndex.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 50);
  }, [searchIndex, searchQuery]);

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

  const flyTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        ...FLY_REGION_DELTA,
      },
      2000
    );
  }, []);

  const handleSearchSelect = useCallback(
    (hit: SearchHit) => {
      setSearchQuery(hit.name);
      setShowSearchResults(false);
      Keyboard.dismiss();
      setSelectedArea(null);
      setSelectedGym(null);
      setMapMode(hit.type === 'area' ? 'areas' : 'gyms');
      flyTo(hit.latitude, hit.longitude);
      if (hit.type === 'area') {
        const area = climbingAreas.find((a) => a.id === hit.id);
        if (area) setSelectedArea(area);
      } else {
        const gym = gyms.find((g) => g.id === hit.id);
        if (gym) setSelectedGym(gym);
      }
    },
    [climbingAreas, gyms, flyTo]
  );

  const handleViewArea = (areaId: string) => {
    setSelectedArea(null);
    (navigation as { navigate: (name: 'AreaDetail', params: { areaId: string }) => void }).navigate(
      'AreaDetail',
      { areaId }
    );
  };

  const handleViewGym = (gymId: string) => {
    setSelectedGym(null);
    (navigation as { navigate: (name: 'GymDetail', params: { gymId: string }) => void }).navigate(
      'GymDetail',
      { gymId }
    );
  };

  const friendIdsForArea = selectedArea ? (friendsByArea.get(selectedArea.id) ?? []) : [];
  const friendIdsForGym = selectedGym ? (friendsByGym.get(selectedGym.id) ?? []) : [];
  const modalVisible = selectedArea !== null || selectedGym !== null;

  const renderPin = (
    coordinate: { latitude: number; longitude: number },
    hasFriends: boolean,
    onPress: () => void,
    key: string
  ) => {
    const pinSize = hasFriends ? 12 : 10;
    const radius = pinSize / 2;
    const bg = hasFriends ? colors.pinActive : colors.pinInactive;
    return (
      <Marker
        key={key}
        coordinate={coordinate}
        onPress={onPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        {/* Large invisible hit area — small dots are hard to tap on maps */}
        <View style={styles.pinHitArea} collapsable={false}>
          <View
            style={[
              styles.pinDot,
              {
                width: pinSize,
                height: pinSize,
                borderRadius: radius,
                backgroundColor: bg,
                shadowColor: bg,
                ...(hasFriends
                  ? { shadowOpacity: 1, shadowRadius: 12, elevation: 10 }
                  : { shadowOpacity: 0.9, shadowRadius: 6, elevation: 6 }),
              },
            ]}
          />
        </View>
      </Marker>
    );
  };

  if (loading && climbingAreas.length === 0 && gymsWithCoords.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('FindMain')}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backButtonText}>List</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {mapMode === 'areas' ? 'CLIMBING AREAS' : 'GYMS'}
          </Text>
          <Text style={styles.headerSub}>
            {mapMode === 'areas'
              ? `${climbingAreas.length} areas`
              : `${gymsWithCoords.length} gyms on map`}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search area or gym…"
            placeholderTextColor={colors.textFaded}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {showSearchResults && searchQuery.trim().length > 0 && (
          <View style={styles.resultsContainer}>
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredSearch}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              style={styles.resultsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSearchSelect(item)}
                >
                  <Ionicons
                    name={item.type === 'gym' ? 'barbell-outline' : 'location-outline'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.resultLabel}>{item.name}</Text>
                  <Text style={styles.resultSublabel}>
                    {item.type === 'gym' ? 'Gym' : 'Area'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsText}>No matches</Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mapMode === 'areas' && styles.tabActive]}
          onPress={() => {
            setMapMode('areas');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Text style={[styles.tabText, mapMode === 'areas' && styles.tabTextActive]}>
            Climbing Areas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mapMode === 'gyms' && styles.tabActive]}
          onPress={() => {
            setMapMode('gyms');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Text style={[styles.tabText, mapMode === 'gyms' && styles.tabTextActive]}>
            Gyms
          </Text>
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsCompass
          mapType={Platform.OS === 'ios' ? 'hybridFlyover' : 'standard'}
          customMapStyle={Platform.OS === 'android' ? DARK_MAP_STYLE : undefined}
        >
          {mapMode === 'areas'
            ? climbingAreas.map((area) => {
                const friendIdsHere = friendsByArea.get(area.id) ?? [];
                const hasFriends = friendIdsHere.length > 0;
                return renderPin(
                  { latitude: area.latitude, longitude: area.longitude },
                  hasFriends,
                  () => setSelectedArea(area),
                  `area-${area.id}`
                );
              })
            : gymsWithCoords.map((gym) => {
                const friendIdsHere = friendsByGym.get(gym.id) ?? [];
                const hasFriends = friendIdsHere.length > 0;
                return renderPin(
                  { latitude: gym.latitude, longitude: gym.longitude },
                  hasFriends,
                  () => setSelectedGym(gym),
                  `gym-${gym.id}`
                );
              })}
        </MapView>

        <View style={[styles.legend, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.pinInactive }]} />
            <Text style={styles.legendText}>
              {mapMode === 'areas' ? 'Climbing area' : 'Gym'}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.pinActive }]} />
            <Text style={styles.legendText}>Friends here</Text>
          </View>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedArea(null);
          setSelectedGym(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedArea && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedArea.name}
                </Text>
                <Text style={styles.modalLocation}>
                  {[selectedArea.region, selectedArea.country].filter(Boolean).join(', ')}
                </Text>
                {friendIdsForArea.length > 0 ? (
                  <View style={styles.friendsBadge}>
                    <Ionicons name="people" size={14} color={colors.primary} />
                    <Text style={styles.friendsBadgeText}>
                      {friendIdsForArea.length === 1
                        ? `${friendName(friendIdsForArea[0])} is here`
                        : `${friendIdsForArea.map(friendName).join(', ')} are here`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noFriends}>No friends at this area right now</Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewArea(selectedArea.id)}
                  >
                    <Text style={styles.viewButtonText}>View Area</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedArea(null)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {selectedGym && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedGym.name}
                </Text>
                <Text style={styles.modalLocation} numberOfLines={2}>
                  {selectedGym.address || 'Gym'}
                </Text>
                {friendIdsForGym.length > 0 ? (
                  <View style={styles.friendsBadge}>
                    <Ionicons name="people" size={14} color={colors.primary} />
                    <Text style={styles.friendsBadgeText}>
                      {friendIdsForGym.length === 1
                        ? `${friendName(friendIdsForGym[0])} is here`
                        : `${friendIdsForGym.map(friendName).join(', ')} are here`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noFriends}>No friends at this gym right now</Text>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewGym(selectedGym.id)}
                  >
                    <Text style={styles.viewButtonText}>View Gym</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedGym(null)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 56,
  },
  backButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 56,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textFaded,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    zIndex: 20,
    elevation: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: colors.text,
  },
  resultsContainer: {
    maxHeight: 200,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 200,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  resultSublabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyResults: {
    padding: 16,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
    backgroundColor: colors.background,
    zIndex: 10,
    elevation: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.secondaryMuted,
    borderColor: colors.secondaryBorder,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  tabTextActive: {
    color: colors.secondary,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  /** ~48pt target so pins match common minimum touch size; visual stays centered */
  pinHitArea: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDot: {
    borderWidth: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  legend: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  offlineNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.handle,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modalLocation: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successMuted,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  friendsBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  noFriends: {
    fontSize: 13,
    color: colors.textFaded,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: colors.textMuted,
  },
});

export default AreasMapScreen;
