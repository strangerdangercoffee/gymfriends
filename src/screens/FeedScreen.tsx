import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useLocation } from '../context/LocationContext';
import { userAreaVisitsApi } from '../services/api';
import { UserAreaVisit, AreaFeedPost } from '../types';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import AreaFeed from '../components/AreaFeed';
import { colors } from '../theme/colors';

type FeedTarget = { type: 'gym'; id: string; name: string } | { type: 'area'; id: string; name: string };
type FollowedChip = FeedTarget & { visits: number };

const FeedScreen: React.FC = () => {
  const { user } = useAuth();
  const {
    gyms,
    climbingAreas,
    followedGyms,
    followedAreas,
    workoutHistory,
  } = useApp();
  const { hasPermissions, currentLocation } = useLocation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<FeedTarget | null>(null);
  const [showBelayerRequestModal, setShowBelayerRequestModal] = useState(false);
  const [pendingNewPost, setPendingNewPost] = useState<AreaFeedPost | null>(null);
  const [areaVisits, setAreaVisits] = useState<UserAreaVisit[]>([]);
  const isUsingLocation = hasPermissions && !!currentLocation;

  const combinedItems = useMemo((): FeedTarget[] => {
    const gymItems: FeedTarget[] = gyms.map((g) => ({
      type: 'gym',
      id: g.id,
      name: g.name,
    }));
    const areaItems: FeedTarget[] = climbingAreas.map((a) => ({
      type: 'area',
      id: a.id,
      name: a.name,
    }));
    return [...gymItems, ...areaItems].sort((a, b) => a.name.localeCompare(b.name));
  }, [gyms, climbingAreas]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return combinedItems;
    return combinedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [combinedItems, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !isUsingLocation) {
      setAreaVisits([]);
      return;
    }
    userAreaVisitsApi
      .getByUser(user.id)
      .then((visits) => {
        if (!cancelled) setAreaVisits(visits);
      })
      .catch(() => {
        if (!cancelled) setAreaVisits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, isUsingLocation]);

  const gymVisitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const wh of workoutHistory) {
      counts.set(wh.gymId, (counts.get(wh.gymId) || 0) + 1);
    }
    return counts;
  }, [workoutHistory]);

  const areaVisitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const visit of areaVisits) {
      counts.set(visit.areaId, (counts.get(visit.areaId) || 0) + 1);
    }
    return counts;
  }, [areaVisits]);

  const followedChips = useMemo((): FollowedChip[] => {
    const gymsList: FollowedChip[] = followedGyms.map((g) => ({
      type: 'gym',
      id: g.id,
      name: g.name,
      visits: gymVisitCounts.get(g.id) || 0,
    }));
    const areasList: FollowedChip[] = followedAreas.map((a) => ({
      type: 'area',
      id: a.id,
      name: a.name,
      visits: areaVisitCounts.get(a.id) || 0,
    }));
    const all = [...gymsList, ...areasList];
    if (isUsingLocation) {
      all.sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
    } else {
      all.sort((a, b) => a.name.localeCompare(b.name));
    }
    return all;
  }, [followedGyms, followedAreas, gymVisitCounts, areaVisitCounts, isUsingLocation]);

  const handleSelect = useCallback((item: FeedTarget) => {
    setSelectedFeed(item);
    setShowSearchResults(false);
    setSearchQuery(item.name);
    Keyboard.dismiss();
  }, []);

  return (
    <View style={styles.container}>
      {/* Autocomplete search */}
      <View style={[styles.searchSection, { paddingTop: insets.top + 12 }]}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search gyms and areas..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSelectedFeed(null);
                setShowSearchResults(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
        {followedChips.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsLabel}>Following</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={followedChips}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              contentContainerStyle={styles.chipsList}
              renderItem={({ item }) => {
                const isActive =
                  selectedFeed?.id === item.id && selectedFeed?.type === item.type;
                return (
                  <TouchableOpacity
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => handleSelect(item)}
                  >
                    <Ionicons
                      name={item.type === 'gym' ? 'barbell-outline' : 'location-outline'}
                      size={14}
                      color={isActive ? colors.background : colors.textSecondary}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
        {showSearchResults && (
          <View style={styles.resultsContainer}>
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredItems}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelect(item)}
                >
                  <Ionicons
                    name={item.type === 'gym' ? 'barbell-outline' : 'location-outline'}
                    size={20}
                    color="#007AFF"
                  />
                  <Text style={styles.resultLabel}>{item.name}</Text>
                  <Text style={styles.resultSublabel}>{item.type === 'gym' ? 'Gym' : 'Area'}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyResults}>
                  <Text style={styles.emptyResultsText}>
                    {combinedItems.length === 0
                      ? 'No gyms or areas available'
                      : 'No matches'}
                  </Text>
                </View>
              }
              style={styles.resultsList}
            />
          </View>
        )}
      </View>

      {/* Post creation button */}
      <View style={styles.actionBar}>
        <Button
          title="New Post"
          onPress={() => setShowBelayerRequestModal(true)}
          disabled={!selectedFeed}
          style={styles.postButton}
          variant="outlineSecondary"
        />
      </View>

      {/* Area Feed */}
      {selectedFeed ? (
        selectedFeed.type === 'gym' ? (
          <AreaFeed
            gymId={selectedFeed.id}
            pendingNewPost={pendingNewPost}
          />
        ) : (
          <AreaFeed
            areaId={selectedFeed.id}
            pendingNewPost={pendingNewPost}
          />
        )
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="fitness-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyText}>No feed selected</Text>
          <Text style={styles.emptySubtext}>
            Search for a gym or area above to view its feed
          </Text>
        </View>
      )}

      <BelayerRequestModal
        visible={showBelayerRequestModal}
        onClose={() => setShowBelayerRequestModal(false)}
        onSuccess={(post) => {
          setPendingNewPost(post);
          setShowBelayerRequestModal(false);
        }}
        initialGymId={selectedFeed?.type === 'gym' ? selectedFeed.id : undefined}
        initialAreaId={selectedFeed?.type === 'area' ? selectedFeed.id : undefined}
        contextName={selectedFeed?.name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: colors.text,
  },
  resultsContainer: {
    maxHeight: 240,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chipsSection: {
    marginTop: 10,
  },
  chipsLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    fontWeight: '600',
  },
  chipsList: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.background,
  },
  resultsList: {
    maxHeight: 240,
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
  actionBar: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postButton: {
    marginBottom: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default FeedScreen;
