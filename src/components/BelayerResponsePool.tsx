import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { areaFeedApi } from '../services/api';
import { AreaFeedPost, BelayerRequestResponse } from '../types';
import Card from './Card';
import Button from './Button';

interface BelayerResponsePoolProps {
  visible: boolean;
  post: AreaFeedPost;
  onClose: () => void;
  onSelect: (responseId: string) => void;
}

const BelayerResponsePool: React.FC<BelayerResponsePoolProps> = ({
  visible,
  post,
  onClose,
  onSelect,
}) => {
  const { user } = useAuth();
  const [responses, setResponses] = useState<BelayerRequestResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && post.postId) {
      loadResponses();
    }
  }, [visible, post.postId]);

  const loadResponses = async () => {
    setLoading(true);
    try {
      const postResponses = await areaFeedApi.getBelayerRequestResponses(post.postId);
      // Filter to only show available responses
      const availableResponses = postResponses.filter(r => r.status === 'available');
      setResponses(availableResponses);
    } catch (error) {
      console.error('Error loading responses:', error);
      Alert.alert('Error', 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPartner = async (responseId: string) => {
    if (!user?.id) return;

    try {
      await areaFeedApi.selectBelayerResponse(responseId, user.id);
      setSelectedResponseId(responseId);
      Alert.alert('Success', 'Partner selected! They will be notified.');
      onSelect(responseId);
    } catch (error) {
      console.error('Error selecting partner:', error);
      Alert.alert('Error', 'Failed to select partner');
    }
  };

  const formatGradeRange = (profile: any) => {
    if (!profile) return 'No profile';
    
    const parts: string[] = [];
    if (profile.leadClimbing !== 'no') {
      parts.push(`Lead: ${profile.leadGradeMin || '?'}-${profile.leadGradeMax || '?'}`);
    }
    if (profile.topRope !== 'no') {
      parts.push(`TR: ${profile.topRopeGradeMin || '?'}-${profile.topRopeGradeMax || '?'}`);
    }
    if (profile.bouldering !== 'no') {
      parts.push(`Boulder: ${profile.boulderGradeMax || '?'}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'No grades specified';
  };

  const renderResponse = ({ item: response }: { item: BelayerRequestResponse }) => {
    const isSelected = selectedResponseId === response.responseId || response.status === 'selected';
    const profile = response.responderProfile;

    return (
      <Card style={[styles.responseCard, isSelected && styles.responseCardSelected]}>
        <View style={styles.responseHeader}>
          <View style={styles.responderInfo}>
            {response.responderAvatar ? (
              <Image source={{ uri: response.responderAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color="#999" />
              </View>
            )}
            <View style={styles.responderDetails}>
              <Text style={styles.responderName}>{response.responderName || 'Anonymous'}</Text>
              {profile && (
                <Text style={styles.responderGrades}>{formatGradeRange(profile)}</Text>
              )}
            </View>
          </View>
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            </View>
          )}
        </View>

        {response.message && (
          <Text style={styles.responseMessage}>{response.message}</Text>
        )}

        {profile && (
          <View style={styles.profileDetails}>
            {profile.leadClimbing !== 'no' && (
              <View style={styles.profileTag}>
                <Ionicons name="arrow-up" size={14} color="#666" />
                <Text style={styles.profileTagText}>Lead</Text>
              </View>
            )}
            {profile.topRope !== 'no' && (
              <View style={styles.profileTag}>
                <Ionicons name="arrow-down" size={14} color="#666" />
                <Text style={styles.profileTagText}>Top Rope</Text>
              </View>
            )}
            {profile.bouldering !== 'no' && (
              <View style={styles.profileTag}>
                <Ionicons name="cube" size={14} color="#666" />
                <Text style={styles.profileTagText}>Bouldering</Text>
              </View>
            )}
          </View>
        )}

        {!isSelected && (
          <Button
            title="Select as Partner"
            onPress={() => handleSelectPartner(response.responseId)}
            style={styles.selectButton}
          />
        )}
      </Card>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Available Partners</Text>
              <Text style={styles.subtitle}>
                {post.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <Text>Loading responses...</Text>
            </View>
          ) : responses.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>No responses yet</Text>
              <Text style={styles.emptySubtext}>
                Share your request to get more responses!
              </Text>
            </View>
          ) : (
            <FlatList
              data={responses}
              renderItem={renderResponse}
              keyExtractor={(item) => item.responseId}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <Text style={styles.listHeader}>
                  {responses.length} {responses.length === 1 ? 'person' : 'people'} available
                </Text>
              }
            />
          )}
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 20,
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  responseCard: {
    marginBottom: 16,
    padding: 16,
  },
  responseCardSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#34C759',
    borderWidth: 2,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  responderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  responderDetails: {
    flex: 1,
  },
  responderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  responderGrades: {
    fontSize: 12,
    color: '#666',
  },
  selectedBadge: {
    marginLeft: 12,
  },
  responseMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
    paddingLeft: 4,
  },
  profileDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  profileTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F9F9F9',
    borderRadius: 4,
  },
  profileTagText: {
    fontSize: 12,
    color: '#666',
  },
  selectButton: {
    marginTop: 8,
  },
  centered: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default BelayerResponsePool;
