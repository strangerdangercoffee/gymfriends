import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Gym } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';

const GymsScreen: React.FC = () => {
  const { gyms, isLoading, followGym, unfollowGym, checkIn, checkOut, refreshData, presence } = useApp();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'traditional' | 'climbing' | 'specialty' | 'crossfit' | 'martial_arts'>('all');

  // Only show followed gyms in the main view
  const followedGyms = gyms.filter(gym => 
    user?.followedGyms?.includes(gym.id)
  );

  // For search modal - filter all gyms based on search query and category
  const searchFilteredGyms = gyms.filter(gym => {
    const matchesSearch = gym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         gym.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || gym.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Helper function to check if user is currently at a specific gym
  const isUserAtGym = (gymId: string): boolean => {
    if (!user) return false;
    return presence.some(p => p.gymId === gymId && p.userId === user.id && p.isActive);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFollowGym = async (gym: Gym) => {
    try {
      await followGym(gym.id);
      Alert.alert('Success', `Now following ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to follow gym');
    }
  };

  const handleUnfollowGym = async (gym: Gym) => {
    Alert.alert(
      'Unfollow Gym',
      `Are you sure you want to unfollow ${gym.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unfollow', 
          style: 'destructive',
          onPress: async () => {
            try {
              await unfollowGym(gym.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to unfollow gym');
            }
          }
        },
      ]
    );
  };

  const handleSearchGymFollow = async (gym: Gym) => {
    const isFollowing = user?.followedGyms?.includes(gym.id);
    if (isFollowing) {
      await handleUnfollowGym(gym);
    } else {
      await handleFollowGym(gym);
    }
  };

  const openSearchModal = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSearchModalVisible(true);
  };

  const closeSearchModal = () => {
    setSearchModalVisible(false);
    setSearchQuery('');
  };

  const handleCheckIn = async (gym: Gym) => {
    try {
      await checkIn(gym.id);
      Alert.alert('Success', `Checked in to ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to check in');
    }
  };

  const handleCheckOut = async (gym: Gym) => {
    try {
      await checkOut(gym.id);
      Alert.alert('Success', `Checked out of ${gym.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to check out');
    }
  };

  const getCategoryIcon = (category: Gym['category']) => {
    switch (category) {
      case 'traditional':
        return 'fitness-outline';
      case 'climbing':
        return 'trending-up-outline';
      case 'specialty':
        return 'star-outline';
      case 'crossfit':
        return 'flash-outline';
      case 'martial_arts':
        return 'shield-outline';
      default:
        return 'fitness-outline';
    }
  };

  const getCategoryColor = (category: Gym['category']) => {
    switch (category) {
      case 'traditional':
        return '#007AFF';
      case 'climbing':
        return '#FF9500';
      case 'specialty':
        return '#AF52DE';
      case 'crossfit':
        return '#FF3B30';
      case 'martial_arts':
        return '#34C759';
      default:
        return '#007AFF';
    }
  };

  const renderFollowedGymCard = ({ item }: { item: Gym }) => {
    const isAtGym = isUserAtGym(item.id);
    const currentUserCount = item.currentUsers?.length || 0;
    const followerCount = item.followers?.length || 0;

    return (
      <Card style={styles.gymCard}>
        <View style={styles.gymHeader}>
          <View style={styles.gymInfo}>
            <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}>
              <Ionicons 
                name={getCategoryIcon(item.category) as any} 
                size={20} 
                color="white" 
              />
            </View>
            <View style={styles.gymDetails}>
              <Text style={styles.gymName}>{item.name}</Text>
              <Text style={styles.gymAddress}>{item.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.gymStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {currentUserCount} {currentUserCount === 1 ? 'person' : 'people'} here
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
            </Text>
          </View>
        </View>

        <View style={styles.gymActions}>
          {isAtGym ? (
            <Button
              title="Check Out"
              variant="outline"
              onPress={() => handleCheckOut(item)}
              style={styles.checkOutButton}
            />
          ) : (
            <Button
              title="Check In"
              onPress={() => handleCheckIn(item)}
              style={styles.checkInButton}
            />
          )}
        </View>
      </Card>
    );
  };

  const renderSearchGymCard = ({ item }: { item: Gym }) => {
    const isFollowing = user?.followedGyms?.includes(item.id);
    const isAtGym = isUserAtGym(item.id);
    const currentUserCount = item.currentUsers?.length || 0;
    const followerCount = item.followers?.length || 0;

    return (
      <Card style={styles.searchGymCard}>
        <View style={styles.gymHeader}>
          <View style={styles.gymInfo}>
            <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}>
              <Ionicons 
                name={getCategoryIcon(item.category) as any} 
                size={20} 
                color="white" 
              />
            </View>
            <View style={styles.gymDetails}>
              <Text style={styles.gymName}>{item.name}</Text>
              <Text style={styles.gymAddress}>{item.address}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.followButton}
            onPress={() => handleSearchGymFollow(item)}
          >
            <Ionicons 
              name={isFollowing ? "heart" : "heart-outline"} 
              size={20} 
              color={isFollowing ? "#FF3B30" : "#8E8E93"} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.gymStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {currentUserCount} {currentUserCount === 1 ? 'person' : 'people'} here
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="heart-outline" size={16} color="#8E8E93" />
            <Text style={styles.statText}>
              {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="fitness-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No followed gyms</Text>
      <Text style={styles.emptySubtitle}>
        Tap "Find my gym" to search and follow gyms
      </Text>
    </View>
  );

  const renderSearchEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No gyms found</Text>
      <Text style={styles.emptySubtitle}>
        Try a different search term or category
      </Text>
    </View>
  );

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'traditional', label: 'Traditional' },
    { key: 'climbing', label: 'Climbing' },
    { key: 'specialty', label: 'Specialty' },
    { key: 'crossfit', label: 'CrossFit' },
    { key: 'martial_arts', label: 'Martial Arts' },
  ] as const;

  return (
    <View style={styles.container}>
      {/* Header with Find My Gym Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Gyms</Text>
        <Button
          title="Find my gym"
          onPress={openSearchModal}
          style={styles.findGymButton}
        />
      </View>

      {/* Followed Gyms List */}
      <FlatList
        data={followedGyms}
        renderItem={renderFollowedGymCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeSearchModal}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Find Gyms</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search gyms by name or address..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Category Filter */}
          <View style={styles.categoryFilter}>
            <FlatList
              data={categories}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    selectedCategory === item.key && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(item.key)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === item.key && styles.categoryTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
          </View>

          {/* Search Results */}
          <FlatList
            data={searchFilteredGyms}
            renderItem={renderSearchGymCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.searchListContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderSearchEmptyState}
          />
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  findGymButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  gymCard: {
    marginBottom: 12,
  },
  searchGymCard: {
    marginBottom: 8,
  },
  gymHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  gymInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gymDetails: {
    flex: 1,
  },
  gymName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gymAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followButton: {
    padding: 8,
  },
  gymStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  gymActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  checkInButton: {
    minWidth: 120,
  },
  checkOutButton: {
    minWidth: 120,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  categoryFilter: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  categoryList: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  categoryTextActive: {
    color: 'white',
  },
  searchListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default GymsScreen;
