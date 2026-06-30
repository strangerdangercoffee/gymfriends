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
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { directMessagesApi } from '../services/api';
import { ChatMessage, MessagesStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { colors } from '../theme/colors';

/** Extends ChatMessage with a local-only pending flag for optimistic messages. */
type LocalChatMessage = ChatMessage & { _pending?: boolean };

type DirectChatRouteProp = RouteProp<MessagesStackParamList, 'DirectChat'>;

const DirectChatScreen: React.FC = () => {
  const route = useRoute<DirectChatRouteProp>();
  const { user } = useAuth();
  const { conversationId, otherUserId, otherUserName } = route.params;
  const { isOffline } = useNetwork();

  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load messages (cache-aside: api.ts returns cached data when offline)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const msgs = await directMessagesApi.getMessages(conversationId, 50);
        if (!cancelled) setMessages(msgs);
        // Only mark read when online
        if (user?.id && !isOffline) {
          await directMessagesApi.markRead(conversationId, user.id);
        }
      } catch (e) {
        // Offline or network error — stay on empty state rather than crashing
        console.warn('DirectChat: failed to load messages', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Realtime subscription — skip while offline; resumes automatically on reconnect
  useEffect(() => {
    if (isOffline) return;
    let channel: ReturnType<typeof directMessagesApi.subscribe> | null = null;
    try {
      channel = directMessagesApi.subscribe(conversationId, async (rawMsg) => {
        try {
          const fresh = await directMessagesApi.getMessages(conversationId, 1);
          if (fresh.length === 0) return;
          const newMsg = fresh[0];
          setMessages((prev) => {
            // Replace matching pending message (clientId dedup) or skip true duplicate
            const dedupedPrev = prev.filter(
              (m) => !(m._pending && m.messageText === newMsg.messageText && m.senderUserId === newMsg.senderUserId)
            );
            if (dedupedPrev.some((m) => m.messageId === newMsg.messageId)) return dedupedPrev;
            return [...dedupedPrev, newMsg];
          });
          if (newMsg.senderUserId !== user?.id && user?.id) {
            await directMessagesApi.markRead(conversationId, user.id);
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch {}
      });
    } catch (e) {
      console.warn('DirectChat: subscription error', e);
    }
    return () => {
      try { channel?.unsubscribe(); } catch {}
    };
  }, [conversationId, user?.id, isOffline]);

  const handleSend = async () => {
    if (!messageText.trim() || !user?.id || sending) return;
    const text = messageText.trim();
    setMessageText('');

    // Optimistic message — shown immediately; replaced by the real message on reconnect
    const optimisticId = `pending-${Date.now()}`;
    const optimistic: LocalChatMessage = {
      messageId: optimisticId,
      chatId: conversationId,
      senderUserId: user.id,
      messageText: text,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setSending(true);
    try {
      const msg = await directMessagesApi.sendMessage(conversationId, user.id, text, 'text');
      // Replace optimistic entry with the confirmed message
      setMessages((prev) =>
        prev.map((m) => (m.messageId === optimisticId ? { ...msg, _pending: false } : m))
      );
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      if (isOffline) {
        // Keep the optimistic message — it's queued and will send on reconnect
      } else {
        Alert.alert('Error', 'Failed to send message');
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setMessageText(text);
      }
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendMedia = async (uri: string, type: 'image' | 'video') => {
    if (!user?.id) return;
    setSending(true);
    try {
      const ext = uri.split('.').pop() ?? (type === 'video' ? 'mp4' : 'jpg');
      const path = `dm/${conversationId}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const bucket = type === 'video' ? 'chat-videos' : 'chat-images';
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: `${type}/${ext}` });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const mediaUrl = urlData.publicUrl;
      const msg = await directMessagesApi.sendMessage(
        conversationId,
        user.id,
        type === 'video' ? '🎥 Video' : '📷 Image',
        'image',
        type === 'video' ? { videoUrl: mediaUrl } : { imageUrl: mediaUrl }
      );
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', `Failed to upload ${type}`);
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      await uploadAndSendMedia(asset.uri, type);
    }
  };

  const handlePickCamera = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      await uploadAndSendMedia(asset.uri, type);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const renderMessage = ({ item }: { item: LocalChatMessage }) => {
    const isOwn = item.senderUserId === user?.id;
    return (
      <View
        style={[
          styles.msgContainer,
          isOwn ? styles.msgOwn : styles.msgOther,
        ]}
      >
        {!isOwn && (
          <View style={styles.msgAvatar}>
            {item.senderAvatar ? (
              <Image source={{ uri: item.senderAvatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{(item.senderName ?? otherUserName).charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, item._pending && styles.bubblePending]}>
          {item.messageType === 'image' && item.metadata?.imageUrl && (
            <Image source={{ uri: item.metadata.imageUrl }} style={styles.msgImage} />
          )}
          <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>{item.messageText}</Text>
          {item._pending ? (
            <Text style={[styles.msgTime, styles.msgTimePending]}>Sending when online...</Text>
          ) : (
            <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{formatTime(item.createdAt)}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Offline notice */}
      {isOffline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={styles.offlineNoticeText}>Showing saved data — you're offline.</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageId}
        contentContainerStyle={styles.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.mediaBtn} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaBtn} onPress={handlePickCamera}>
          <Ionicons name="camera-outline" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="send" size={20} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  msgList: { padding: 16, paddingBottom: 8 },
  msgContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgOwn: { justifyContent: 'flex-end' },
  msgOther: { justifyContent: 'flex-start' },
  msgAvatar: { marginRight: 8 },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  bubbleOwn: { backgroundColor: colors.primaryMuted, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  msgText: { fontSize: 16, color: colors.text, lineHeight: 20 },
  msgTextOwn: { color: colors.text },
  msgTime: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  msgTimeOwn: { color: colors.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  mediaBtn: { padding: 8, marginRight: 8 },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    fontSize: 16,
    color: colors.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  bubblePending: { opacity: 0.65 },
  msgTimePending: { fontSize: 11, color: colors.textFaded, marginTop: 4, fontStyle: 'italic' },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  offlineNoticeText: { fontSize: 12, color: colors.textMuted },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.textMuted },
});

export default DirectChatScreen;
