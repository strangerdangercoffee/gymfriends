import React, { useState, useMemo, useCallback } from 'react';
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
import { Gym, ClimbingArea } from '../types';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import AreaFeed from '../components/AreaFeed';

type FeedTarget = { type: 'gym'; id: string; name: string } | { type: 'area'; id: string; name: string };

const FeedScreen: React.FC = () => {
  const { user } = useAuth();
  const { followedGyms, followedAreas } = useApp();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<FeedTarget | null>(null);
  const [showBelayerRequestModal, setShowBelayerRequestModal] = useState(false);

  const combinedItems = useMemo((): FeedTarget[] => {
    const gyms: FeedTarget[] = followedGyms.map((g) => ({ type: 'gym', id: g.id, name: g.name }));
    const areas: FeedTarget[] = followedAreas.map((a) => ({ type: 'area', id: a.id, name: a.name }));
    return [...gyms, ...areas];
  }, [followedGyms, followedAreas]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return combinedItems;
    return combinedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [combinedItems, searchQuery]);

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
                      ? 'Follow gyms or areas to see them here'
                      : 'No matches'}
                  </Text>
                </View>
              }
              style={styles.resultsList}
            />
          </View>
        )}
      </View>

      {/* Post Request Button */}
      <View style={styles.actionBar}>
        <Button
          title="Post Belayer Request"
          onPress={() => setShowBelayerRequestModal(true)}
          style={styles.postButton}
        />
      </View>

      {/* Area Feed */}
      {selectedFeed ? (
        selectedFeed.type === 'gym' ? (
          <AreaFeed gymId={selectedFeed.id} postType="belayer_request" />
        ) : (
          <AreaFeed areaId={selectedFeed.id} />
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
        onSuccess={() => setShowBelayerRequestModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  searchSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    color: '#000',
  },
  resultsContainer: {
    maxHeight: 240,
    marginTop: 8,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    overflow: 'hidden',
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
    borderBottomColor: '#E5E5E7',
  },
  resultLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  resultSublabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyResults: {
    padding: 16,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionBar: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
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
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default FeedScreen;
