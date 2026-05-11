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
import Button from './Button';
import { colors } from '../theme/colors';

interface OnboardingGymSelectionProps {
  onComplete: (selectedGymIds: string[]) => void;
  initialSelectedGyms?: string[];
}

const OnboardingGymSelection: React.FC<OnboardingGymSelectionProps> = ({
  onComplete,
  initialSelectedGyms = [],
}) => {
  const { gyms, followGym } = useApp();
  const [selectedGymIds, setSelectedGymIds] = useState<string[]>(initialSelectedGyms);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredGyms = gyms.filter((gym) => {
    const q = searchQuery.toLowerCase();
    return (
      gym.name.toLowerCase().includes(q) ||
      gym.address.toLowerCase().includes(q)
    );
  });

  const toggleGymSelection = async (gymId: string) => {
    const isSelected = selectedGymIds.includes(gymId);
    if (isSelected) {
      setSelectedGymIds((prev) => prev.filter((id) => id !== gymId));
    } else {
      setSelectedGymIds((prev) => [...prev, gymId]);
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
      <TouchableOpacity
        style={[styles.gymCard, isSelected && styles.gymCardSelected]}
        onPress={() => toggleGymSelection(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.gymIcon}>
          <Ionicons name="barbell-outline" size={20} color={isSelected ? colors.primary : colors.textMuted} />
        </View>
        <View style={styles.gymInfo}>
          <Text style={[styles.gymName, isSelected && styles.gymNameSelected]}>{item.name}</Text>
          <Text style={styles.gymAddress}>{item.address}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={colors.background} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="barbell" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Select Your Gyms</Text>
        <Text style={styles.description}>
          Choose the climbing gyms you visit. You can always add more later!
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search gyms…"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredGyms}
        renderItem={renderGymCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={56} color={colors.textFaded} />
            <Text style={styles.emptyText}>No gyms found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          title={
            selectedGymIds.length === 0
              ? 'Skip for Now'
              : `Continue (${selectedGymIds.length} selected)`
          }
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
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryMuted,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 110,
  },
  gymCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymCardSelected: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
  },
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 3,
  },
  gymNameSelected: {
    color: colors.text,
  },
  gymAddress: {
    fontSize: 13,
    color: colors.textMuted,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textFaded,
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    width: '100%',
  },
});

export default OnboardingGymSelection;
