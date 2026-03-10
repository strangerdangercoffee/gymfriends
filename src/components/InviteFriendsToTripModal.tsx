import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { tripInvitationsApi } from '../services/api';
import { UserAreaPlan } from '../types';
import Button from './Button';

interface InviteFriendsToTripModalProps {
  visible: boolean;
  onClose: () => void;
  trip: UserAreaPlan;
  onSuccess?: () => void;
}

const InviteFriendsToTripModal: React.FC<InviteFriendsToTripModalProps> = ({
  visible,
  onClose,
  trip,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { friends } = useApp();
  const [comment, setComment] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [existingInvitees, setExistingInvitees] = useState<string[]>([]);

  useEffect(() => {
    if (visible && trip?.id) {
      tripInvitationsApi.getByTrip(trip.id).then((invitations) => {
        setExistingInvitees(invitations.map((i) => i.inviteeUserId));
      });
    }
  }, [visible, trip?.id]);

  const toggleFriend = (friendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };

  const handleInvite = async () => {
    if (!user?.id || selectedIds.size === 0) return;
    setSaving(true);
    try {
      for (const inviteeId of selectedIds) {
        await tripInvitationsApi.create(trip.id, user.id, inviteeId, comment.trim() || undefined);
      }
      Alert.alert('Success', 'Invitations sent');
      setComment('');
      setSelectedIds(new Set());
      onSuccess?.();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to send invitations');
    } finally {
      setSaving(false);
    }
  };

  const availableFriends = friends.filter((f) => !existingInvitees.includes(f.id));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Invite friends to trip</Text>
          <Text style={styles.dates}>
            {trip.startDate} – {trip.endDate}
          </Text>
          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="e.g. This is for my birthday, focusing on Solar Slab"
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Select friends</Text>
          <ScrollView style={styles.friendList} nestedScrollEnabled>
            {availableFriends.map((friend) => (
              <TouchableOpacity
                key={friend.id}
                style={[styles.friendRow, selectedIds.has(friend.id) && styles.friendRowSelected]}
                onPress={() => toggleFriend(friend.id)}
              >
                <Text style={styles.friendName}>{friend.name}</Text>
                {selectedIds.has(friend.id) && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
            {availableFriends.length === 0 && (
              <Text style={styles.hint}>All friends already invited or no friends</Text>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Button title="Cancel" onPress={onClose} style={styles.cancelBtn} />
            <Button
              title={saving ? 'Sending...' : 'Send invites'}
              onPress={handleInvite}
              disabled={saving || selectedIds.size === 0}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  dates: { fontSize: 14, color: '#8E8E93', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  friendList: { maxHeight: 200, marginBottom: 16 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  friendRowSelected: { backgroundColor: '#E8F4FF' },
  friendName: { fontSize: 16 },
  check: { color: '#007AFF', fontWeight: '600' },
  hint: { fontSize: 14, color: '#8E8E93', padding: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1 },
});

export default InviteFriendsToTripModal;
