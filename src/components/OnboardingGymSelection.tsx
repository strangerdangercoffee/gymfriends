import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Gym } from '../types';
import Card from './Card';
import Button from './Button';

interface OnboardingGymSelectionProps {
  onComplete: (selectedGymIds: string[]) => void;
  initialSelectedGyms?: string[];
}

const OnboardingGymSelection: React.FC<OnboardingGymSelectionProps> = ({
  onComplete,
  initialSelectedGyms = [],
}) => {
  const { gyms, followGym, isLoading } = useApp();
  const [selectedGymIds, setSelectedGymIds] = useState<string[]>(initialSelectedGyms);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter gyms by search (only climbing gyms are loaded)
  const filteredGyms = gyms.filter(gym => {
    const matchesSearch = gym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         gym.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleGymSelection = async (gymId: string) => {
    const isSelected = selectedGymIds.includes(gymId);
    
    if (isSelected) {
      setSelectedGymIds(prev => prev.filter(id => id !== gymId));
    } else {
      setSelectedGymIds(prev => [...prev, gymId]);
      // Follow the gym immediately
      try {
        await followGym(gymId);
      } catch (error) {
        console.error('Error following gym:', error);
      }
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      // Follow all selected gyms
      for (const gymId of selectedGymIds) {
        if (!initialSelectedGyms.includes(gymId)) {
          try {
            await followGym(gymId);
          } catch (error) {
            console.error(`Error following gym ${gymId}:`, error);
          }
        }
      }
      onComplete(selectedGymIds);
    } catch (error) {
      console.error('Error completing gym selection:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderGymCard = ({ item }: { item: Gym }) => {
    const isSelected = selectedGymIds.includes(item.id);

    return (
      <TouchableOpacity onPress={() => toggleGymSelection(item.id)}>
        <Card style={[styles.gymCard, isSelected && styles.gymCardSelected]}>
          <View style={styles.gymHeader}>
            <View style={[styles.gymIcon, { backgroundColor: '#FF9500' }]}>
              <Ionicons 
                name="trending-up-outline" 
                size={20} 
                color="white" 
              />
            </View>
            <View style={styles.gymInfo}>
              <Text style={styles.gymName}>{item.name}</Text>
              <Text style={styles.gymAddress}>{item.address}</Text>
            </View>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <Ionicons name="checkmark" size={20} color="white" />
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={60} color="#007AFF" />
        </View>
        <Text style={styles.title}>Select Your Gyms</Text>
        <Text style={styles.description}>
          Choose the climbing gyms you'd like to follow. You can always add more later!
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search gyms..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8E8E93"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Gym List */}
      <FlatList
        data={filteredGyms}
        renderItem={renderGymCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No gyms found</Text>
            <Text style={styles.emptySubtext}>Try a different search or add a climbing gym</Text>
          </View>
        }
      />

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title={selectedGymIds.length === 0 ? 'Skip for Now' : `Continue (${selectedGymIds.length} selected)`}
          onPress={handleContinue}
          loading={isSaving}
          variant={selectedGymIds.length === 0 ? 'outline' : 'primary'}
          style={styles.continueButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 100,
  },
  gymCard: {
    marginBottom: 12,
    padding: 16,
  },
  gymCardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  gymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gymAddress: {
    fontSize: 14,
    color: '#8E8E93',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  continueButton: {
    width: '100%',
  },
});

export default OnboardingGymSelection;
