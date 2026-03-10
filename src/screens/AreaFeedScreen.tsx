import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Gym, ClimbingArea } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import AreaFeed from '../components/AreaFeed';
import { GroupsStackParamList } from '../types';
import { StackNavigationProp } from '@react-navigation/stack';

type AreaFeedNav = StackNavigationProp<GroupsStackParamList, 'AreaFeed'>;

const AreaFeedScreen: React.FC = () => {
  const navigation = useNavigation<AreaFeedNav>();
  const { user } = useAuth();
  const { followedGyms, climbingAreas, followedAreas } = useApp();
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [showBelayerRequestModal, setShowBelayerRequestModal] = useState(false);
  const [showAllAreas, setShowAllAreas] = useState(false);

  useEffect(() => {
    if (followedGyms.length > 0 && !selectedGym) {
      setSelectedGym(followedGyms[0]);
    }
  }, [followedGyms]);

  const handleGymSelect = (gym: Gym) => {
    setSelectedGym(gym);
  };

  const handleAreaPress = (areaId: string) => {
    navigation.navigate('AreaDetail', { areaId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Area Feeds</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Gym Selector */}
        {followedGyms.length > 0 && (
          <View style={styles.selectorSection}>
            <Text style={styles.sectionLabel}>Gyms</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {followedGyms.map((gym) => (
                <TouchableOpacity
                  key={gym.id}
                  style={[
                    styles.gymChip,
                    selectedGym?.id === gym.id && styles.gymChipActive,
                  ]}
                  onPress={() => handleGymSelect(gym)}
                >
                  <Text
                    style={[
                      styles.gymChipText,
                      selectedGym?.id === gym.id && styles.gymChipTextActive,
                    ]}
                  >
                    {gym.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Climbing Areas */}
        <View style={styles.selectorSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Climbing areas</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity onPress={() => navigation.navigate('AreasMap')} style={styles.mapLink}>
                <Ionicons name="map" size={18} color="#007AFF" />
                <Text style={styles.seeAllText}>View on map</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAllAreas(!showAllAreas)}>
                <Text style={styles.seeAllText}>{showAllAreas ? 'Hide' : 'Browse all'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showAllAreas ? (
            <View style={styles.areaList}>
              {climbingAreas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={styles.areaRow}
                  onPress={() => handleAreaPress(area.id)}
                >
                  <Ionicons name="location" size={20} color="#007AFF" />
                  <Text style={styles.areaName}>{area.name}</Text>
                  {followedAreas.some((a) => a.id === area.id) && (
                    <Ionicons name="heart" size={16} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
              {climbingAreas.length === 0 && (
                <Text style={styles.emptyAreaText}>No climbing areas yet</Text>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {followedAreas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={styles.gymChip}
                  onPress={() => handleAreaPress(area.id)}
                >
                  <Text style={styles.gymChipText}>{area.name}</Text>
                </TouchableOpacity>
              ))}
              {followedAreas.length === 0 && (
                <Text style={styles.hintText}>Follow areas below to see them here</Text>
              )}
            </ScrollView>
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

        {/* Area Feed (gym only when gym selected) */}
        {selectedGym ? (
          <AreaFeed
            gymId={selectedGym.id}
            postType="belayer_request"
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No gym selected</Text>
            <Text style={styles.emptySubtext}>
              Select a gym above or open a climbing area to view its feed
            </Text>
          </View>
        )}
      </ScrollView>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
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
  content: {
    flex: 1,
  },
  selectorSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    paddingVertical: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipScroll: {
    paddingHorizontal: 16,
  },
  areaList: {
    paddingHorizontal: 16,
    maxHeight: 200,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
    gap: 8,
  },
  areaName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  emptyAreaText: {
    fontSize: 14,
    color: '#8E8E93',
    paddingVertical: 12,
  },
  hintText: {
    fontSize: 13,
    color: '#8E8E93',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gymChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  gymChipActive: {
    backgroundColor: '#007AFF',
  },
  gymChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  gymChipTextActive: {
    color: '#FFF',
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

export default AreaFeedScreen;
