# Group Chat Feature Implementation

## Overview
Group chat functionality has been implemented with the following features:
1. ✅ Simple chat functionality (send/receive messages)
2. ✅ Auto-messaging for workout invitations/responses
3. ✅ Photo and video upload support
4. ✅ Real-time message updates

## What's Been Implemented

### 1. Chat API Functions (`src/services/api.ts`)
- `getGroupChat(groupId)` - Get chat for a group
- `getChatMessages(chatId, limit, before)` - Fetch messages with pagination
- `sendMessage(chatId, senderUserId, messageText, messageType, metadata)` - Send text/image/video/system messages
- `markMessageAsRead(messageId, userId)` - Mark single message as read
- `markMessagesAsRead(messageIds, userId)` - Mark multiple messages as read
- `getUnreadMessageCount(chatId, userId)` - Get unread message count
- `deleteMessage(messageId, userId)` - Soft delete a message
- `uploadImage(fileUri, chatId, userId)` - Upload image to Supabase Storage
- `uploadVideo(fileUri, chatId, userId)` - Upload video to Supabase Storage
- `sendWorkoutInvitationToGroups()` - Auto-send messages when workouts are created
- `sendWorkoutResponseToGroups()` - Auto-send messages when users respond/bail

### 2. GroupChatScreen Component (`src/screens/GroupChatScreen.tsx`)
- Message list with real-time updates
- Text input with send button
- Image and video upload buttons
- Message rendering for different types (text, image, video, system)
- Read receipts
- Auto-scroll to latest message
- Keyboard handling

### 3. Navigation Updates
- Added `GroupsStackParamList` to navigation types
- Created `GroupsStackNavigator` with GroupChat screen
- Updated GroupsScreen to navigate to chat

### 4. Auto-Messaging Integration
- **Workout Creation**: When a workout is created and groups are invited, messages are automatically sent to those group chats
- **Workout Responses**: When users accept/decline/bail from workouts, messages are sent to their group chats

## Setup Required

### 1. Install Dependencies
```bash
npx expo install expo-image-picker
```

### 2. Create Supabase Storage Bucket
1. Go to your Supabase dashboard
2. Navigate to Storage
3. Create a new bucket named `chat-media`
4. Set it to **Public** (or configure RLS policies as needed)
5. Configure CORS if needed for your app domain

### 3. Enable Real-time for Chat Tables
Run this SQL in your Supabase SQL editor:
```sql
-- Enable real-time for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reads;
```

### 4. Storage RLS Policies (Optional but Recommended)
If you want to restrict access, add RLS policies to the `chat-media` bucket:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read from chat-media
CREATE POLICY "Users can read chat media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');
```

## Usage

### Sending Messages
Users can:
- Type and send text messages
- Tap the image icon to upload photos
- Tap the video icon to upload videos
- Messages are sent in real-time to all group members

### Auto-Messaging
- When a workout is created with group invitations, a message is automatically posted to those group chats
- When a user accepts/declines/bails from a workout, a message is posted to their group chats

### Message Types
- **text**: Regular text messages
- **image**: Photo uploads (stored in Supabase Storage)
- **video**: Video uploads (stored in Supabase Storage)
- **system**: Auto-generated messages (workout invitations, responses, etc.)
- **workout-share**: Shared workout links (future feature)

## File Structure
```
src/
  screens/
    GroupChatScreen.tsx       # Main chat UI component
  services/
    api.ts                     # Chat API functions (chatApi)
  types/
    index.ts                   # ChatMessage, GroupChat types
  navigation/
    AppNavigator.tsx           # Updated with GroupsStack
```

## Future Enhancements
- [ ] Message editing
- [ ] Message reactions
- [ ] Typing indicators
- [ ] Push notifications for new messages
- [ ] Message search
- [ ] Media gallery view
- [ ] Voice messages
- [ ] Message forwarding

## Notes
- Messages are soft-deleted (deleted_at timestamp) rather than hard-deleted
- Read receipts are tracked per user per message
- Real-time subscriptions automatically update the UI when new messages arrive
- Image/video uploads are stored in Supabase Storage with organized folder structure: `chatId/userId/timestamp.ext`
