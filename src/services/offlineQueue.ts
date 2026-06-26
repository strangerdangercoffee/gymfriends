import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@gymfriends:offline_queue';

export type QueuedAction =
  // ── Existing action types (do not change) ──────────────────────────────────
  | { type: 'area_visit'; payload: { userId: string; areaId: string } }
  | { type: 'leave_area'; payload: { userId: string; areaId: string } }
  | { type: 'area_feed_post'; payload: any }
  | { type: 'trip_plan_create'; payload: { userId: string; areaId: string; startDate: string; endDate: string; notes?: string } }
  | { type: 'trip_plan_update'; payload: { planId: string; updates: { startDate?: string; endDate?: string; notes?: string } } }
  | { type: 'trip_plan_delete'; payload: { planId: string } }
  | { type: 'trip_invitation_create'; payload: { tripId: string; inviterUserId: string; inviteeUserId: string; comment?: string } }
  | { type: 'trip_invitation_respond'; payload: { invitationId: string; status: 'accepted' | 'declined' } }
  | { type: 'gym_check_in'; payload: { userId: string; gymId: string; location?: { latitude: number; longitude: number } } }
  | { type: 'gym_check_out'; payload: { userId: string; gymId: string } }
  // ── New action types (Wave-2 data agent will enqueue these) ────────────────
  | { type: 'send_direct_message'; payload: { senderId: string; recipientId: string; text: string; clientId: string } }
  | { type: 'send_group_message'; payload: { groupId: string; senderId: string; text: string; clientId: string } }
  | { type: 'create_post_comment'; payload: { postId: string; userId: string; text: string; clientId: string } }
  | { type: 'update_profile'; payload: { userId: string; updates: Record<string, unknown> } }
  | { type: 'schedule_create'; payload: { payload: Record<string, unknown> } }
  | { type: 'schedule_update'; payload: { scheduleId: string; updates: Record<string, unknown> } }
  | { type: 'schedule_delete'; payload: { scheduleId: string } }
  | { type: 'belayer_request_create'; payload: { payload: Record<string, unknown> } }
  | { type: 'belayer_request_respond'; payload: { requestId: string; status: string } }
  | { type: 'follow_area'; payload: { userId: string; areaId: string } }
  | { type: 'unfollow_area'; payload: { userId: string; areaId: string } };

export interface QueueItem {
  id: string;
  action: QueuedAction;
  createdAt: number;
}

/** Runner implemented by the app (api.ts) to avoid circular dependency. */
export interface OfflineQueueRunner {
  // ── Existing required methods ──────────────────────────────────────────────
  areaVisit: (userId: string, areaId: string) => Promise<void>;
  leaveArea: (userId: string, areaId: string) => Promise<void>;
  areaFeedPost: (post: any) => Promise<void>;
  tripPlanCreate: (userId: string, areaId: string, startDate: string, endDate: string, notes?: string) => Promise<void>;
  tripPlanUpdate: (planId: string, updates: { startDate?: string; endDate?: string; notes?: string }) => Promise<void>;
  tripPlanDelete: (planId: string) => Promise<void>;
  tripInvitationCreate: (tripId: string, inviterUserId: string, inviteeUserId: string, comment?: string) => Promise<void>;
  tripInvitationRespond: (invitationId: string, status: 'accepted' | 'declined') => Promise<void>;
  gymCheckIn: (userId: string, gymId: string, location?: { latitude: number; longitude: number }) => Promise<void>;
  gymCheckOut: (userId: string, gymId: string) => Promise<void>;
  // ── New optional methods (data agent implements; existing runner still compiles) ──
  sendDirectMessage?: (senderId: string, recipientId: string, text: string, clientId: string) => Promise<void>;
  sendGroupMessage?: (groupId: string, senderId: string, text: string, clientId: string) => Promise<void>;
  createPostComment?: (postId: string, userId: string, text: string, clientId: string) => Promise<void>;
  updateProfile?: (userId: string, updates: Record<string, unknown>) => Promise<void>;
  scheduleCreate?: (payload: Record<string, unknown>) => Promise<void>;
  scheduleUpdate?: (scheduleId: string, updates: Record<string, unknown>) => Promise<void>;
  scheduleDelete?: (scheduleId: string) => Promise<void>;
  belayerRequestCreate?: (payload: Record<string, unknown>) => Promise<void>;
  belayerRequestRespond?: (requestId: string, status: string) => Promise<void>;
  followArea?: (userId: string, areaId: string) => Promise<void>;
  unfollowArea?: (userId: string, areaId: string) => Promise<void>;
}

async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('offlineQueue.saveQueue failed', e);
  }
}

export const offlineQueue = {
  async add(action: QueuedAction): Promise<void> {
    const queue = await loadQueue();
    const id = `${action.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    queue.push({ id, action, createdAt: Date.now() });
    await saveQueue(queue);
  },

  async getAll(): Promise<QueueItem[]> {
    return loadQueue();
  },

  async remove(id: string): Promise<void> {
    const queue = await loadQueue();
    const next = queue.filter((i) => i.id !== id);
    if (next.length !== queue.length) await saveQueue(next);
  },

  async clear(): Promise<void> {
    await saveQueue([]);
  },

  async processQueue(runner: OfflineQueueRunner): Promise<{ processed: number; failed: number }> {
    const queue = await loadQueue();
    let processed = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        switch (item.action.type) {
          // ── Existing cases ─────────────────────────────────────────────────
          case 'area_visit':
            await runner.areaVisit(item.action.payload.userId, item.action.payload.areaId);
            break;
          case 'leave_area':
            await runner.leaveArea(item.action.payload.userId, item.action.payload.areaId);
            break;
          case 'area_feed_post':
            await runner.areaFeedPost(item.action.payload);
            break;
          case 'trip_plan_create':
            await runner.tripPlanCreate(
              item.action.payload.userId,
              item.action.payload.areaId,
              item.action.payload.startDate,
              item.action.payload.endDate,
              item.action.payload.notes
            );
            break;
          case 'trip_plan_update':
            await runner.tripPlanUpdate(item.action.payload.planId, item.action.payload.updates);
            break;
          case 'trip_plan_delete':
            await runner.tripPlanDelete(item.action.payload.planId);
            break;
          case 'trip_invitation_create':
            await runner.tripInvitationCreate(
              item.action.payload.tripId,
              item.action.payload.inviterUserId,
              item.action.payload.inviteeUserId,
              item.action.payload.comment
            );
            break;
          case 'trip_invitation_respond':
            await runner.tripInvitationRespond(item.action.payload.invitationId, item.action.payload.status);
            break;
          case 'gym_check_in':
            await runner.gymCheckIn(
              item.action.payload.userId,
              item.action.payload.gymId,
              item.action.payload.location
            );
            break;
          case 'gym_check_out':
            await runner.gymCheckOut(item.action.payload.userId, item.action.payload.gymId);
            break;
          // ── New cases (optional runner methods; skip gracefully if not implemented) ──
          case 'send_direct_message':
            if (runner.sendDirectMessage) {
              await runner.sendDirectMessage(
                item.action.payload.senderId,
                item.action.payload.recipientId,
                item.action.payload.text,
                item.action.payload.clientId
              );
            } else {
              console.warn('offlineQueue: sendDirectMessage not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'send_group_message':
            if (runner.sendGroupMessage) {
              await runner.sendGroupMessage(
                item.action.payload.groupId,
                item.action.payload.senderId,
                item.action.payload.text,
                item.action.payload.clientId
              );
            } else {
              console.warn('offlineQueue: sendGroupMessage not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'create_post_comment':
            if (runner.createPostComment) {
              await runner.createPostComment(
                item.action.payload.postId,
                item.action.payload.userId,
                item.action.payload.text,
                item.action.payload.clientId
              );
            } else {
              console.warn('offlineQueue: createPostComment not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'update_profile':
            if (runner.updateProfile) {
              await runner.updateProfile(item.action.payload.userId, item.action.payload.updates);
            } else {
              console.warn('offlineQueue: updateProfile not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'schedule_create':
            if (runner.scheduleCreate) {
              await runner.scheduleCreate(item.action.payload.payload);
            } else {
              console.warn('offlineQueue: scheduleCreate not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'schedule_update':
            if (runner.scheduleUpdate) {
              await runner.scheduleUpdate(item.action.payload.scheduleId, item.action.payload.updates);
            } else {
              console.warn('offlineQueue: scheduleUpdate not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'schedule_delete':
            if (runner.scheduleDelete) {
              await runner.scheduleDelete(item.action.payload.scheduleId);
            } else {
              console.warn('offlineQueue: scheduleDelete not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'belayer_request_create':
            if (runner.belayerRequestCreate) {
              await runner.belayerRequestCreate(item.action.payload.payload);
            } else {
              console.warn('offlineQueue: belayerRequestCreate not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'belayer_request_respond':
            if (runner.belayerRequestRespond) {
              await runner.belayerRequestRespond(item.action.payload.requestId, item.action.payload.status);
            } else {
              console.warn('offlineQueue: belayerRequestRespond not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'follow_area':
            if (runner.followArea) {
              await runner.followArea(item.action.payload.userId, item.action.payload.areaId);
            } else {
              console.warn('offlineQueue: followArea not implemented in runner');
              failed++;
              continue;
            }
            break;
          case 'unfollow_area':
            if (runner.unfollowArea) {
              await runner.unfollowArea(item.action.payload.userId, item.action.payload.areaId);
            } else {
              console.warn('offlineQueue: unfollowArea not implemented in runner');
              failed++;
              continue;
            }
            break;
          default:
            failed++;
            continue;
        }
        await this.remove(item.id);
        processed++;
      } catch (err) {
        console.warn('offlineQueue process item failed', item.id, err);
        failed++;
      }
    }
    return { processed, failed };
  },
};
