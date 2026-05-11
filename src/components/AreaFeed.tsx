import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  TextInput,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { areaFeedApi } from '../services/api';
import { AreaFeedPost, BelayerRequestResponse } from '../types';
import Card from './Card';
import Button from './Button';
import BelayerResponsePool from './BelayerResponsePool';
import { colors } from '../theme/colors';
import { getBelayerRequestFeedTitle } from '../utils/belayerRequestTitles';

interface AreaFeedProps {
  gymId?: string;
  areaId?: string;
  cragName?: string;
  postType?: string;
  onPostPress?: (post: AreaFeedPost) => void;
  /** Optional header rendered above the feed (use when embedding in a screen that would otherwise wrap this in ScrollView). */
  listHeaderComponent?: React.ReactNode;
}

const AreaFeed: React.FC<AreaFeedProps> = ({
  gymId,
  areaId,
  cragName,
  postType,
  onPostPress,
  listHeaderComponent,
}) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<AreaFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<AreaFeedPost | null>(null);
  const [showResponsePool, setShowResponsePool] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingPost, setReportingPost] = useState<AreaFeedPost | null>(null);
  const [reportReason, setReportReason] = useState('');

  // Helper function to check if belayer request post is expired (1 hour after start time)
  const isBelayerRequestExpired = (post: AreaFeedPost): boolean => {
    if (post.postType !== 'belayer_request' && post.postType !== 'rally_pads_request') {
      return false; // Not a belayer request, so not expired
    }

    const now = new Date();
    let startTime: Date;

    if (post.urgency === 'now') {
      // For "now" requests, use creation time
      startTime = new Date(post.createdAt);
    } else if (post.scheduledTime) {
      // For scheduled requests, use scheduled time
      startTime = new Date(post.scheduledTime);
    } else {
      // Fallback to creation time
      startTime = new Date(post.createdAt);
    }

    // Add 1 hour to start time
    const expiryTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // Check if current time is past expiry
    return now > expiryTime;
  };

  useEffect(() => {
    loadPosts();
  }, [gymId, areaId, cragName, postType]);

  // Periodically filter out expired belayer request posts (every 5 minutes)
  useEffect(() => {
    if (posts.length === 0) return;

    const interval = setInterval(() => {
      setPosts((prev) => {
        const filtered = prev.filter((p) => !isBelayerRequestExpired(p));
        // Only update if posts were removed
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [posts.length]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const feedPosts = await areaFeedApi.getAreaFeed(gymId, cragName, 50, postType, areaId);
      // Additional client-side filtering as backup (API should already filter)
      const filteredPosts = feedPosts.filter((post) => !isBelayerRequestExpired(post));
      setPosts(filteredPosts);
    } catch (error) {
      console.error('Error loading feed:', error);
      Alert.alert('Error', 'Failed to load feed posts');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleRespond = async (post: AreaFeedPost) => {
    if (!user?.id) return;

    try {
      await areaFeedApi.respondToBelayerRequest(post.postId, user.id);
      Alert.alert('Success', 'Your response has been sent!');
      await loadPosts();
    } catch (error) {
      console.error('Error responding:', error);
      Alert.alert('Error', 'Failed to respond to request');
    }
  };

  const handleViewResponses = async (post: AreaFeedPost) => {
    try {
      const fullPost = await areaFeedApi.getFeedPost(post.postId);
      setSelectedPost(fullPost);
      setShowResponsePool(true);
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load responses');
    }
  };

  const handleReport = async () => {
    if (!reportingPost || !user?.id || !reportReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for reporting');
      return;
    }

    try {
      await areaFeedApi.reportPost(reportingPost.postId, user.id, reportReason.trim());
      Alert.alert('Success', 'Post reported. Thank you for helping keep the community safe.');
      setShowReportModal(false);
      setReportingPost(null);
      setReportReason('');
    } catch (error) {
      console.error('Error reporting post:', error);
      Alert.alert('Error', 'Failed to report post');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderPost = ({ item: post }: { item: AreaFeedPost }) => {
    const isAuthor = post.authorUserId === user?.id;
    const isBelayerRequest = post.postType === 'belayer_request' || post.postType === 'rally_pads_request';
    const hasResponded = isBelayerRequest && user?.id && 
      post.availableResponders?.some(r => r.responderUserId === user.id);

    return (
      <Card style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            {post.authorAvatar ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>{post.authorName || 'Anonymous'}</Text>
              <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setReportingPost(post);
              setShowReportModal(true);
            }}
            style={styles.reportButton}
          >
            <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!isBelayerRequest && (
          <View style={styles.postTypeBadge}>
            <Text style={styles.postTypeText}>
              {post.postType === 'trip_announcement' ? '✈️ Trip plan' :
               post.postType === 'lost_found' ? '🔍 Lost & Found' :
               post.postType === 'discussion' ? '💬 Discussion' : '📌 General'}
            </Text>
          </View>
        )}

        <Text style={styles.postTitle}>
          {isBelayerRequest
            ? getBelayerRequestFeedTitle(
                post.authorName,
                post.postType as 'belayer_request' | 'rally_pads_request',
                post.climbingType
              )
            : post.title}
        </Text>
        <Text style={styles.postContent}>{post.content}</Text>

        {isBelayerRequest && (
          <View style={styles.belayerDetails}>
            {post.urgency === 'scheduled' && post.scheduledTime && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={16} color={colors.textMuted} />
                <Text style={styles.detailText}>
                  {new Date(post.scheduledTime).toLocaleString()}
                </Text>
              </View>
            )}
            {post.urgency === 'now' && (
              <View style={styles.detailRow}>
                <Ionicons name="flash" size={16} color={colors.secondary} />
                <Text style={[styles.detailText, styles.urgentText]}>Right now</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.postFooter}>
          {isBelayerRequest && (
            <>
              {isAuthor ? (
                <TouchableOpacity
                  style={styles.responseButton}
                  onPress={() => handleViewResponses(post)}
                >
                  <Ionicons name="people" size={18} color={colors.primary} />
                  <Text style={styles.responseButtonText}>
                    {post.responseCount || 0} {post.responseCount === 1 ? 'response' : 'responses'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Button
                  title={hasResponded ? "✓ I'm Free" : "I'm Free"}
                  onPress={() => handleRespond(post)}
                  style={
                    StyleSheet.flatten([
                      styles.imFreeButton,
                      hasResponded ? styles.imFreeButtonActive : undefined,
                    ]) as ViewStyle
                  }
                  disabled={!!hasResponded}
                />
              )}
            </>
          )}
        </View>
      </Card>
    );
  };

  const renderReportModal = () => {
    if (!showReportModal || !reportingPost) return null;

    return (
      <View style={styles.modalOverlay}>
        <Card style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Post</Text>
            <TouchableOpacity onPress={() => {
              setShowReportModal(false);
              setReportingPost(null);
              setReportReason('');
            }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Please provide a reason for reporting this post:
          </Text>
          <TextInput
            style={styles.reportInput}
            placeholder="Reason for reporting..."
            value={reportReason}
            onChangeText={setReportReason}
            multiline
            numberOfLines={4}
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowReportModal(false);
                setReportingPost(null);
                setReportReason('');
              }}
              style={styles.cancelButton}
            />
            <Button
              title="Submit Report"
              onPress={handleReport}
              style={styles.submitButton}
            />
          </View>
        </Card>
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.postId}
        ListHeaderComponent={
          listHeaderComponent ? <>{listHeaderComponent}</> : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to post!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {showResponsePool && selectedPost && (
        <BelayerResponsePool
          visible={showResponsePool}
          post={selectedPost}
          onClose={() => {
            setShowResponsePool(false);
            setSelectedPost(null);
          }}
          onSelect={(responseId) => {
            // Handle partner selection
            setShowResponsePool(false);
            setSelectedPost(null);
            loadPosts();
          }}
        />
      )}

      {renderReportModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
  },
  postCard: {
    marginBottom: 16,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  postTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  reportButton: {
    padding: 4,
  },
  postTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: 4,
    marginBottom: 8,
  },
  postTypeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  belayerDetails: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  urgentText: {
    color: colors.secondary,
    fontWeight: '600',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  responseButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  imFreeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  imFreeButtonActive: {
    backgroundColor: colors.secondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
  },
  submitButton: {
    flex: 1,
  },
});

export default AreaFeed;
