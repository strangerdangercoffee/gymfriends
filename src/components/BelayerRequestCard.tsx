import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { areaFeedApi } from '../services/api';
import { AreaFeedPost } from '../types';
import Card from './Card';

interface BelayerRequestCardProps {
  postId: string;
  senderName?: string;
  senderUserId?: string; // Author user ID
  messageText: string;
  postType?: 'belayer_request' | 'rally_pads_request';
  climbingType?: 'lead' | 'top_rope' | 'bouldering' | 'any';
  scheduledTime?: string;
  gymName?: string;
  cragName?: string;
  targetRoute?: string;
  targetGrade?: string;
}

const BelayerRequestCard: React.FC<BelayerRequestCardProps> = ({
  postId,
  senderName,
  senderUserId,
  messageText,
  postType,
  climbingType,
  scheduledTime,
  gymName: metadataGymName,
  cragName: metadataCragName,
  targetRoute: metadataTargetRoute,
  targetGrade: metadataTargetGrade,
}) => {
  const { user } = useAuth();
  const [post, setPost] = useState<AreaFeedPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [selectingPartner, setSelectingPartner] = useState<string | null>(null);
  
  // Check if user is author - use senderUserId from metadata or post authorUserId
  const isAuthor = user?.id && (senderUserId === user.id || post?.authorUserId === user.id);

  useEffect(() => {
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const fullPost = await areaFeedApi.getFeedPost(postId);
      
      // Check if user is author (use senderUserId from props or post authorUserId)
      const userIsAuthor = user?.id && (senderUserId === user.id || fullPost.authorUserId === user.id);
      
      // If user is author, load all responses (including selected ones)
      if (userIsAuthor) {
        const allResponses = await areaFeedApi.getBelayerRequestResponses(postId);
        // Update post with all responses, not just available ones
        setPost({
          ...fullPost,
          availableResponders: allResponses,
        });
      } else {
        setPost(fullPost);
        
        // Check if user has already responded
        if (user?.id && fullPost.availableResponders) {
          const responded = fullPost.availableResponders.some(
            (r) => r.responderUserId === user.id
          );
          setHasResponded(responded);
        }
      }
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!user?.id || hasResponded) return;

    setResponding(true);
    try {
      await areaFeedApi.respondToBelayerRequest(postId, user.id);
      setHasResponded(true);
      Alert.alert('Success', 'Your response has been sent!');
      // Reload post to get updated responder count
      await loadPost();
    } catch (error: any) {
      console.error('Error responding:', error);
      Alert.alert('Error', error.message || 'Failed to respond to request');
    } finally {
      setResponding(false);
    }
  };

  const handleSelectPartner = async (responseId: string) => {
    if (!user?.id || selectingPartner) return;

    setSelectingPartner(responseId);
    try {
      await areaFeedApi.selectBelayerResponse(responseId, user.id);
      Alert.alert('Success', 'Partner selected! They will be notified.');
      // Reload post to get updated status
      await loadPost();
    } catch (error: any) {
      console.error('Error selecting partner:', error);
      Alert.alert('Error', error.message || 'Failed to select partner');
    } finally {
      setSelectingPartner(null);
    }
  };

  const formatClimbingType = (type?: string) => {
    if (!type || type === 'any') return 'Climbing';
    return type === 'top_rope' ? 'Top Rope' : 
           type === 'bouldering' ? 'Bouldering' : 
           type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Right now';
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 0) return 'Right now';
    if (diffMins < 60) return `In ${diffMins}m`;
    if (diffHours < 24) return `In ${diffHours}h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const requestTypeText = postType === 'rally_pads_request' ? 'Rally Pads' : 'Belayer';
  const climbingTypeText = formatClimbingType(climbingType);
  const timeText = formatTime(scheduledTime);

  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={postType === 'rally_pads_request' ? 'people' : 'fitness'} 
            size={24} 
            color="#007AFF" 
          />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{requestTypeText} Request</Text>
          {senderName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.detailsRow}>
          <Ionicons name="barbell-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{climbingTypeText}</Text>
        </View>
        {(post?.targetRoute || metadataTargetRoute) && (
          <View style={styles.detailsRow}>
            <Ionicons name="map-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{post?.targetRoute || metadataTargetRoute}</Text>
            {(post?.targetGrade || metadataTargetGrade) && (
              <Text style={styles.detailText}> • {post?.targetGrade || metadataTargetGrade}</Text>
            )}
          </View>
        )}
        <View style={styles.detailsRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{timeText}</Text>
        </View>
        {(post?.gymName || metadataGymName) && (
          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{post?.gymName || metadataGymName}</Text>
          </View>
        )}
        {(post?.cragName || metadataCragName) && (
          <View style={styles.detailsRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.detailText}>{post?.cragName || metadataCragName}</Text>
          </View>
        )}
      </View>

      {post?.content && (
        <Text style={styles.description} numberOfLines={2}>
          {post.content}
        </Text>
      )}

      {/* Author view: Show list of responders */}
      {isAuthor && post?.availableResponders && post.availableResponders.length > 0 && (
        <View style={styles.respondersSection}>
          <Text style={styles.respondersSectionTitle}>
            {post.availableResponders.length} {post.availableResponders.length === 1 ? 'Person' : 'People'} Available
          </Text>
          {post.availableResponders.map((responder) => {
            const isSelected = responder.status === 'selected';
            const isSelecting = selectingPartner === responder.responseId;
            
            return (
              <View key={responder.responseId} style={styles.responderItem}>
                <View style={styles.responderInfo}>
                  {responder.responderAvatar ? (
                    <Image source={{ uri: responder.responderAvatar }} style={styles.responderAvatar} />
                  ) : (
                    <View style={styles.responderAvatarPlaceholder}>
                      <Text style={styles.responderAvatarText}>
                        {responder.responderName?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.responderName}>{responder.responderName || 'Unknown'}</Text>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                      <Text style={styles.selectedText}>Selected</Text>
                    </View>
                  )}
                </View>
                {!isSelected && (
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => handleSelectPartner(responder.responseId)}
                    disabled={isSelecting}
                  >
                    {isSelecting ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#007AFF" />
                        <Text style={styles.selectButtonText}>Select</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Non-author view: Show "I'm Free" button */}
      {!isAuthor && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.respondButton, hasResponded && styles.respondButtonDisabled]}
            onPress={handleRespond}
            disabled={hasResponded || responding}
          >
            {responding ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons 
                  name={hasResponded ? 'checkmark-circle' : 'hand-left-outline'} 
                  size={18} 
                  color="white" 
                />
                <Text style={styles.respondButtonText}>
                  {hasResponded ? 'You Responded' : "I'm Free"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Show responder count for non-authors */}
      {!isAuthor && post && post.availableResponders && post.availableResponders.length > 0 && (
        <View style={styles.respondersInfo}>
          <Ionicons name="people" size={14} color="#666" />
          <Text style={styles.respondersText}>
            {post.availableResponders.length} {post.availableResponders.length === 1 ? 'person' : 'people'} available
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  respondButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  respondButtonDisabled: {
    backgroundColor: '#34C759',
  },
  respondButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginRight: 4,
  },
  respondersSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  },
  respondersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  responderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  responderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  responderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  responderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  responderAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  responderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectedText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  respondersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
    gap: 6,
  },
  respondersText: {
    fontSize: 12,
    color: '#666',
  },
});

export default BelayerRequestCard;
