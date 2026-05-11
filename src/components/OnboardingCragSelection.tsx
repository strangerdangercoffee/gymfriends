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
import { ClimbingArea } from '../types';
import Button from './Button';
import { colors } from '../theme/colors';

interface OnboardingCragSelectionProps {
  onComplete: () => void;
}

const OnboardingCragSelection: React.FC<OnboardingCragSelectionProps> = ({ onComplete }) => {
  const { climbingAreas, followedAreas, followArea, unfollowArea } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set());

  const followedIds = new Set(followedAreas.map((a) => a.id));

  const filteredAreas = climbingAreas.filter((area) => {
    const q = searchQuery.toLowerCase();
    return (
      area.name.toLowerCase().includes(q) ||
      (area.region ?? '').toLowerCase().includes(q) ||
      (area.country ?? '').toLowerCase().includes(q)
    );
  });

  const isFollowed = (areaId: string) =>
    followedIds.has(areaId) || pendingFollows.has(areaId);

  const toggleArea = async (areaId: string) => {
    if (isFollowed(areaId)) {
      setPendingFollows((prev) => {
        const next = new Set(prev);
        next.delete(areaId);
        return next;
      });
      try {
        await unfollowArea(areaId);
      } catch (error) {
        console.error('Error unfollowing area:', error);
      }
    } else {
      setPendingFollows((prev) => new Set([...prev, areaId]));
      try {
        await followArea(areaId);
      } catch (error) {
        console.error('Error following area:', error);
        setPendingFollows((prev) => {
          const next = new Set(prev);
          next.delete(areaId);
          return next;
        });
      }
    }
  };

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = climbingAreas.filter((a) => isFollowed(a.id)).length;

  const renderAreaCard = ({ item }: { item: ClimbingArea }) => {
    const selected = isFollowed(item.id);
    const subtitle = [item.region, item.country].filter(Boolean).join(', ');

    return (
      <TouchableOpacity
        style={[styles.areaCard, selected && styles.areaCardSelected]}
        onPress={() => toggleArea(item.id)}
        activeOpacity={0.75}
      >
        <View style={[styles.areaIcon, selected && styles.areaIconSelected]}>
          <Ionicons
            name="location"
            size={20}
            color={selected ? colors.primary : colors.textMuted}
          />
        </View>
        <View style={styles.areaInfo}>
          <Text style={[styles.areaName, selected && styles.areaNameSelected]}>{item.name}</Text>
          {subtitle ? <Text style={styles.areaSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={16} color={colors.background} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="location" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Select Your Crags</Text>
        <Text style={styles.description}>
          Follow outdoor climbing areas to see local activity and find partners. You can add more from the map later!
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search areas, regions…"
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
        data={filteredAreas}
        renderItem={renderAreaCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={56} color={colors.textFaded} />
            <Text style={styles.emptyText}>No areas found</Text>
            <Text style={styles.emptySubtext}>Try a different search term or explore the map later</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          title={
            selectedCount === 0
              ? 'Skip for Now'
              : `Continue (${selectedCount} followed)`
          }
          onPress={handleContinue}
          loading={isSaving}
          variant={selectedCount === 0 ? 'outline' : 'primary'}
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
    backgroundColor: colors.secondaryMuted,
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
    paddingHorizontal: 16,
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
  areaCard: {
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
  areaCardSelected: {
    borderColor: colors.secondaryBorder,
    backgroundColor: colors.secondaryMuted,
  },
  areaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaIconSelected: {
    backgroundColor: 'rgba(245, 133, 63, 0.2)',
  },
  areaInfo: {
    flex: 1,
  },
  areaName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 3,
  },
  areaNameSelected: {
    color: colors.text,
  },
  areaSubtitle: {
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
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
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
    textAlign: 'center',
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

export default OnboardingCragSelection;
