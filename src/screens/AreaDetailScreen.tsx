import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { climbingAreasApi, userAreaPlansApi, tripInvitationsApi } from '../services/api';
import { ClimbingArea, UserAreaPlan } from '../types';
import AreaFeed from '../components/AreaFeed';
import Button from '../components/Button';
import BelayerRequestModal from '../components/BelayerRequestModal';
import PlanTripModal from '../components/PlanTripModal';
import InviteFriendsToTripModal from '../components/InviteFriendsToTripModal';
import { GroupsStackParamList } from '../types';

type AreaDetailRouteProp = RouteProp<GroupsStackParamList, 'AreaDetail'>;

const AreaDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AreaDetailRouteProp>();
  const { areaId } = route.params;
  const { user } = useAuth();
  const { followArea, unfollowArea, followedAreas } = useApp();
  const [area, setArea] = useState<ClimbingArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBelayerRequestModal, setShowBelayerRequestModal] = useState(false);
  const [showPlanTripModal, setShowPlanTripModal] = useState(false);
  const [inviteTrip, setInviteTrip] = useState<UserAreaPlan | null>(null);
  const [myPlans, setMyPlans] = useState<UserAreaPlan[]>([]);
  const [friendsPlans, setFriendsPlans] = useState<{ plan: UserAreaPlan; inviterName?: string }[]>([]);

  const isFollowing = followedAreas.some((a) => a.id === areaId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await climbingAreasApi.getById(areaId);
        if (!cancelled) setArea(a);
      } catch (e) {
        if (!cancelled) Alert.alert('Error', 'Failed to load area');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [areaId]);

  const loadPlans = async () => {
    if (!user?.id || !areaId) return;
    try {
      const mine = await userAreaPlansApi.getByUser(user.id).then((plans) => plans.filter((p) => p.areaId === areaId));
      setMyPlans(mine);
      const today = new Date().toISOString().slice(0, 10);
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const start = mine.length > 0 ? mine.reduce((a, p) => (p.startDate < a ? p.startDate : a), mine[0].startDate) : today;
      const end = mine.length > 0 ? mine.reduce((a, p) => (p.endDate > a ? p.endDate : a), mine[0].endDate) : future;
      const fp = await userAreaPlansApi.getFriendsPlansAtArea(user.id, areaId, start, end);
      setFriendsPlans(fp || []);
    } catch {
      setMyPlans([]);
      setFriendsPlans([]);
    }
  };

  useEffect(() => {
    if (areaId && user?.id) loadPlans();
  }, [areaId, user?.id]);

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) await unfollowArea(areaId);
      else await followArea(areaId);
    } catch {
      Alert.alert('Error', 'Failed to update follow');
    }
  };

  if (loading || !area) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{area.name}</Text>
        <View style={styles.placeholder} />
      </View>

      <AreaFeed
        areaId={areaId}
        listHeaderComponent={
          <>
            <View style={styles.areaMeta}>
          {area.region || area.country ? (
            <Text style={styles.areaMetaText}>{[area.region, area.country].filter(Boolean).join(', ')}</Text>
          ) : null}
          <TouchableOpacity onPress={handleFollowToggle} style={styles.followButton}>
            <Ionicons name={isFollowing ? 'heart' : 'heart-outline'} size={20} color={isFollowing ? '#007AFF' : '#8E8E93'} />
            <Text style={[styles.followText, isFollowing && styles.followTextActive]}>{isFollowing ? 'Following' : 'Follow area'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionBar}>
          <Button
            title="Plan a trip"
            onPress={() => setShowPlanTripModal(true)}
            style={styles.secondaryButton}
          />
          <Button
            title="New belayer request"
            onPress={() => setShowBelayerRequestModal(true)}
            style={styles.primaryButton}
          />
        </View>

        {myPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My trips</Text>
            {myPlans.map((plan) => (
              <View key={plan.id} style={styles.planRow}>
                <Text style={styles.planDates}>{plan.startDate} – {plan.endDate}</Text>
                {plan.notes ? <Text style={styles.planNotes}>{plan.notes}</Text> : null}
                <TouchableOpacity onPress={() => setInviteTrip(plan)} style={styles.inviteLink}>
                  <Text style={styles.inviteLinkText}>Invite friends</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {friendsPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friends’ trips here</Text>
            {friendsPlans.map(({ plan, inviterName }) => (
              <View key={plan.id} style={styles.planRow}>
                <Text style={styles.planDates}>{plan.startDate} – {plan.endDate}</Text>
                {inviterName && <Text style={styles.friendName}>{inviterName}</Text>}
              </View>
            ))}
          </View>
        )}
          </>
        }
      />

      <PlanTripModal
        visible={showPlanTripModal}
        onClose={() => setShowPlanTripModal(false)}
        areaId={areaId}
        areaName={area?.name ?? ''}
        onSuccess={loadPlans}
      />

      {inviteTrip && (
        <InviteFriendsToTripModal
          visible={!!inviteTrip}
          onClose={() => setInviteTrip(null)}
          trip={inviteTrip}
          onSuccess={loadPlans}
        />
      )}

      <BelayerRequestModal
        visible={showBelayerRequestModal}
        onClose={() => setShowBelayerRequestModal(false)}
        onSuccess={() => setShowBelayerRequestModal(false)}
        initialAreaId={areaId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
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
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: { width: 32 },
  areaMeta: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaMetaText: { fontSize: 14, color: '#8E8E93' },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followText: { fontSize: 14, color: '#8E8E93' },
  followTextActive: { color: '#007AFF' },
  actionBar: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
    gap: 10,
  },
  primaryButton: { marginBottom: 0 },
  secondaryButton: { marginBottom: 0 },
  section: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  planRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  planDates: { fontSize: 15, fontWeight: '500' },
  planNotes: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  friendName: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  inviteLink: { marginTop: 6 },
  inviteLinkText: { fontSize: 14, color: '#007AFF' },
});

export default AreaDetailScreen;
