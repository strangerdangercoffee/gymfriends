import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { chatApi, areaFeedApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { supabase } from '../services/supabase';
import BelayerRequestCard from '../components/BelayerRequestCard';

type GroupChatRouteParams = {
  GroupChat: {
    groupId: string;
    groupName: string;
  };
};

type GroupChatScreenRouteProp = RouteProp<GroupChatRouteParams, 'GroupChat'>;
type GroupChatScreenNavigationProp = StackNavigationProp<GroupChatRouteParams, 'GroupChat'>;

// Helper function to check if belayer request message is expired (1 hour after start time)
const isBelayerRequestExpired = (message: ChatMessage): boolean => {
  if (message.metadata?.action !== 'belayer_request') {
    return false; // Not a belayer request, so not expired
  }

  const now = new Date();
  let startTime: Date;

  const scheduledTime = message.metadata?.scheduledTime;
  const createdAt = new Date(message.createdAt);

  if (scheduledTime) {
    // For scheduled requests, use scheduled time
    startTime = new Date(scheduledTime);
  } else {
    // For "now" requests, use message creation time
    startTime = createdAt;
  }

  // Add 1 hour to start time
  const expiryTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  
  // Check if current time is past expiry
  return now > expiryTime;
};

const GroupChatScreen: React.FC = () => {
  const route = useRoute<GroupChatScreenRouteProp>();
  const navigation = useNavigation<GroupChatScreenNavigationProp>();
  const { user } = useAuth();
  const { groupId, groupName } = route.params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load chat and messages
  useEffect(() => {
    loadChat();
  }, [groupId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!chatId) return;

    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          // Fetch the new message with user data
          try {
            const newMessages = await chatApi.getChatMessages(chatId, 1);
            if (newMessages.length > 0) {
              const newMessage = newMessages[0];
              // Filter out expired belayer request messages
              if (isBelayerRequestExpired(newMessage)) {
                return; // Don't add expired messages
              }
              
              setMessages((prev) => {
                // Check if message already exists
                const exists = prev.some((m) => m.messageId === newMessage.messageId);
                if (exists) return prev;
                
                // Also filter out any expired messages from previous list
                const filteredPrev = prev.filter((m) => !isBelayerRequestExpired(m));
                
                return [...filteredPrev, newMessage].sort(
                  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
              });
              // Mark as read if not sent by current user
              if (newMessage.senderUserId !== user?.id) {
                await chatApi.markMessageAsRead(newMessage.messageId, user!.id);
              }
            }
          } catch (error) {
            console.error('Error fetching new message:', error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId, user?.id]);

  // Periodically filter out expired belayer request messages (every 5 minutes)
  useEffect(() => {
    if (!chatId || messages.length === 0) return;

    const interval = setInterval(() => {
      setMessages((prev) => {
        const filtered = prev.filter((m) => !isBelayerRequestExpired(m));
        // Only update if messages were removed
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [chatId, messages.length]);

  const loadChat = async () => {
    try {
      setLoading(true);
      const chat = await chatApi.getGroupChat(groupId);
      setChatId(chat.chatId);

      const chatMessages = await chatApi.getChatMessages(chat.chatId, 50);
      // Filter out expired belayer request messages
      const filteredMessages = chatMessages.filter((msg) => !isBelayerRequestExpired(msg));
      setMessages(filteredMessages.reverse()); // Reverse to show oldest first

      // Mark all messages as read
      if (user?.id && filteredMessages.length > 0) {
        const unreadMessageIds = filteredMessages
          .filter((m) => m.senderUserId !== user.id)
          .map((m) => m.messageId);
        if (unreadMessageIds.length > 0) {
          await chatApi.markMessagesAsRead(unreadMessageIds, user.id);
        }
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      Alert.alert('Error', 'Failed to load chat messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId || !user?.id || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const newMessage = await chatApi.sendMessage(chatId, user.id, text, 'text');
      setMessages((prev) => [...prev, newMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessageText(text); // Restore message text on error
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    if (!chatId || !user?.id) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSending(true);
        try {
          // Upload image
          const imageUrl = await chatApi.uploadImage(result.assets[0].uri, chatId, user.id);
          
          // Send message with image
          const newMessage = await chatApi.sendMessage(
            chatId,
            user.id,
            '📷 Image',
            'image',
            { imageUrl, thumbnailUrl: imageUrl }
          );
          
          setMessages((prev) => [...prev, newMessage]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        } finally {
          setSending(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handlePickVideo = async () => {
    if (!chatId || !user?.id) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload videos.');
        return;
      }

      // Launch video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSending(true);
        try {
          // Upload video
          const videoUrl = await chatApi.uploadVideo(result.assets[0].uri, chatId, user.id);
          
          // Send message with video
          const newMessage = await chatApi.sendMessage(
            chatId,
            user.id,
            '🎥 Video',
            'video',
            { videoUrl }
          );
          
          setMessages((prev) => [...prev, newMessage]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch (error) {
          console.error('Error uploading video:', error);
          Alert.alert('Error', 'Failed to upload video. Please try again.');
        } finally {
          setSending(false);
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.senderUserId === user?.id;
    const isSystemMessage = item.messageType === 'system';
    const isBelayerRequest = isSystemMessage && item.metadata?.action === 'belayer_request' && item.metadata?.postId;

    // Render belayer request card for system messages with belayer request metadata
    if (isBelayerRequest) {
      return (
        <View style={styles.belayerRequestContainer}>
          <BelayerRequestCard
            postId={item.metadata.postId}
            senderName={item.senderName}
            senderUserId={item.metadata.senderUserId || item.senderUserId}
            messageText={item.messageText}
            postType={item.metadata.postType as 'belayer_request' | 'rally_pads_request' | undefined}
            climbingType={item.metadata.climbingType as 'lead' | 'top_rope' | 'bouldering' | 'any' | undefined}
            scheduledTime={item.metadata.scheduledTime}
            gymName={item.metadata.gymName}
            cragName={item.metadata.cragName}
            targetRoute={item.metadata.targetRoute}
            targetGrade={item.metadata.targetGrade}
          />
        </View>
      );
    }

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.messageText}</Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwnMessage && (
          <View style={styles.avatarContainer}>
            {item.senderAvatar ? (
              <Image source={{ uri: item.senderAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.senderName?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.senderName || 'Unknown'}</Text>
          )}
          {item.messageType === 'image' && item.metadata?.imageUrl && (
            <Image source={{ uri: item.metadata.imageUrl }} style={styles.messageImage} />
          )}
          {item.messageType === 'video' && item.metadata?.videoUrl && (
            <View style={styles.videoContainer}>
              <Ionicons name="videocam" size={24} color="#007AFF" />
              <Text style={styles.videoText}>Video</Text>
            </View>
          )}
          {item.messageType === 'workout-share' && (
            <View style={styles.workoutShareContainer}>
              <Ionicons name="fitness" size={20} color="#007AFF" />
              <Text style={styles.workoutShareText}>
                {item.metadata?.workoutTitle || 'Workout'}
              </Text>
            </View>
          )}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.messageText}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageId}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePickVideo}>
          <Ionicons name="videocam-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  videoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  videoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  workoutShareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  workoutShareText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  belayerRequestContainer: {
    marginVertical: 8,
    paddingHorizontal: 0,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  mediaButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});

export default GroupChatScreen;
