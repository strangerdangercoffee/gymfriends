import { supabase } from './supabase';
import { notificationService } from './notifications';
import { 
  WorkoutInvitation, 
  WorkoutInvitationResponse, 
  WorkoutInvitationWithResponses,
  CreateWorkoutInvitationData,
  User,
  Gym
} from '../types';

// Transform functions for database format
const transformWorkoutInvitationFromDB = (dbInvitation: any): WorkoutInvitation => ({
  id: dbInvitation.id,
  inviterId: dbInvitation.inviter_id,
  scheduleId: dbInvitation.schedule_id,
  title: dbInvitation.title,
  description: dbInvitation.description,
  gymId: dbInvitation.gym_id,
  startTime: dbInvitation.start_time,
  endTime: dbInvitation.end_time,
  isRecurring: dbInvitation.is_recurring,
  recurringPattern: dbInvitation.recurring_pattern,
  workoutType: dbInvitation.workout_type,
  status: dbInvitation.status,
  createdAt: dbInvitation.created_at,
  updatedAt: dbInvitation.updated_at,
  associatedGroupIds: dbInvitation.associated_group_ids || [],
});

const transformWorkoutInvitationToDB = (invitation: Partial<WorkoutInvitation>): any => ({
  id: invitation.id,
  inviter_id: invitation.inviterId,
  schedule_id: invitation.scheduleId,
  title: invitation.title,
  description: invitation.description,
  gym_id: invitation.gymId,
  start_time: invitation.startTime,
  end_time: invitation.endTime,
  is_recurring: invitation.isRecurring,
  recurring_pattern: invitation.recurringPattern,
  workout_type: invitation.workoutType,
  status: invitation.status,
});

const transformWorkoutInvitationResponseFromDB = (dbResponse: any): WorkoutInvitationResponse => ({
  id: dbResponse.id,
  invitationId: dbResponse.invitation_id,
  userId: dbResponse.user_id,
  response: dbResponse.response,
  bailedAt: dbResponse.bailed_at,
  bailReason: dbResponse.bail_reason,
  createdAt: dbResponse.created_at,
  updatedAt: dbResponse.updated_at,
});

const transformWorkoutInvitationResponseToDB = (response: Partial<WorkoutInvitationResponse>): any => ({
  id: response.id,
  invitation_id: response.invitationId,
  user_id: response.userId,
  response: response.response,
  bailed_at: response.bailedAt,
  bail_reason: response.bailReason,
});

export class WorkoutInvitationService {
  private static instance: WorkoutInvitationService;

  static getInstance(): WorkoutInvitationService {
    if (!WorkoutInvitationService.instance) {
      WorkoutInvitationService.instance = new WorkoutInvitationService();
    }
    return WorkoutInvitationService.instance;
  }

  async createWorkoutInvitation(
    inviterId: string, 
    invitationData: CreateWorkoutInvitationData
  ): Promise<WorkoutInvitation> {
    // Create the main invitation record
    const dbInvitationData = {
      inviter_id: inviterId,
      schedule_id: invitationData.scheduleId,
      title: invitationData.title,
      description: invitationData.description,
      gym_id: invitationData.gymId,
      start_time: invitationData.startTime,
      end_time: invitationData.endTime,
      is_recurring: invitationData.isRecurring,
      recurring_pattern: invitationData.recurringPattern,
      workout_type: invitationData.workoutType,
      status: 'active' as const,
      associated_group_ids: invitationData.associatedGroupIds || [],
    };

    const { data: invitation, error: invitationError } = await supabase
      .from('workout_invitations')
      .insert([dbInvitationData])
      .select()
      .single();

    if (invitationError) throw invitationError;

    // Create response records for each invited user
    const responseRecords = invitationData.invitedUserIds.map(userId => ({
      invitation_id: invitation.id,
      user_id: userId,
      response: 'pending' as const,
    }));

    const { error: responsesError } = await supabase
      .from('workout_invitation_responses')
      .insert(responseRecords);

    if (responsesError) throw responsesError;

    // Send notifications to invited users
    await this.sendInvitationNotifications(invitation.id, invitationData.invitedUserIds);

    return transformWorkoutInvitationFromDB(invitation);
  }

  async getWorkoutInvitationsForUser(userId: string): Promise<WorkoutInvitationWithResponses[]> {
    // Get invitations where user is invited
    const { data: responses, error: responsesError } = await supabase
      .from('workout_invitation_responses')
      .select(`
        *,
        workout_invitations (
          *,
          users!workout_invitations_inviter_id_fkey (
            id, name, email, avatar
          ),
          gyms (
            id, name, address
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (responsesError) throw responsesError;

    // Transform the data
    const invitations: WorkoutInvitationWithResponses[] = [];
    
    for (const response of responses || []) {
      const invitation = response.workout_invitations;
      if (invitation) {
        // Get all responses for this invitation
        const { data: allResponses, error: allResponsesError } = await supabase
          .from('workout_invitation_responses')
          .select(`
            *,
            users (
              id, name, email, avatar
            )
          `)
          .eq('invitation_id', invitation.id);

        if (allResponsesError) throw allResponsesError;

        // Transform responses and include user information
        const transformedResponses = (allResponses || []).map((dbResponse: any) => ({
          ...transformWorkoutInvitationResponseFromDB(dbResponse),
          user: dbResponse.users ? {
            id: dbResponse.users.id,
            name: dbResponse.users.name,
            email: dbResponse.users.email,
            avatar: dbResponse.users.avatar,
          } : undefined,
        }));

        invitations.push({
          ...transformWorkoutInvitationFromDB(invitation),
          responses: transformedResponses as any,
          inviter: invitation.users,
          gym: invitation.gyms,
        });
      }
    }

    return invitations;
  }

  async getWorkoutInvitationsCreatedByUser(userId: string): Promise<WorkoutInvitationWithResponses[]> {
    const { data: invitations, error: invitationsError } = await supabase
      .from('workout_invitations')
      .select(`
        *,
        users!workout_invitations_inviter_id_fkey (
          id, name, email, avatar
        ),
        gyms (
          id, name, address
        )
      `)
      .eq('inviter_id', userId)
      .order('created_at', { ascending: false });

    if (invitationsError) throw invitationsError;

    const invitationsWithResponses: WorkoutInvitationWithResponses[] = [];

    for (const invitation of invitations || []) {
      // Get all responses for this invitation
      const { data: responses, error: responsesError } = await supabase
        .from('workout_invitation_responses')
        .select(`
          *,
          users (
            id, name, email, avatar
          )
        `)
        .eq('invitation_id', invitation.id);

      if (responsesError) throw responsesError;

      // Transform responses and include user information
      const transformedResponses = (responses || []).map((dbResponse: any) => ({
        ...transformWorkoutInvitationResponseFromDB(dbResponse),
        user: dbResponse.users ? {
          id: dbResponse.users.id,
          name: dbResponse.users.name,
          email: dbResponse.users.email,
          avatar: dbResponse.users.avatar,
        } : undefined,
      }));

      invitationsWithResponses.push({
        ...transformWorkoutInvitationFromDB(invitation),
        responses: transformedResponses as any,
        inviter: invitation.users,
        gym: invitation.gyms,
      });
    }

    return invitationsWithResponses;
  }

  async respondToInvitation(
    invitationId: string, 
    userId: string, 
    response: 'accepted' | 'declined'
  ): Promise<void> {
    const { error } = await supabase
      .from('workout_invitation_responses')
      .update({ 
        response,
        updated_at: new Date().toISOString()
      })
      .eq('invitation_id', invitationId)
      .eq('user_id', userId);

    if (error) throw error;

    // Send notification to inviter about the response
    await this.sendResponseNotification(invitationId, userId, response);
  }

  async bailFromWorkout(
    invitationId: string, 
    userId: string, 
    reason?: string
  ): Promise<void> {
    console.log(`[bailFromWorkout] Starting bail for invitation ${invitationId}, user ${userId}`);
    
    // First, get the invitation to find the schedule_id and start_time
    const { data: invitation, error: invitationError } = await supabase
      .from('workout_invitations')
      .select('schedule_id, start_time')
      .eq('id', invitationId)
      .single();

    if (invitationError) {
      console.error('[bailFromWorkout] Error fetching invitation:', invitationError);
      throw invitationError;
    }

    console.log(`[bailFromWorkout] Found invitation, schedule_id: ${invitation.schedule_id}`);

    // Update the response to 'bailed'
    console.log(`[bailFromWorkout] Attempting to update response for invitation ${invitationId}, user ${userId}`);
    const { data: updatedResponse, error: updateError } = await supabase
      .from('workout_invitation_responses')
      .update({ 
        response: 'bailed',
        bailed_at: new Date().toISOString(),
        bail_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('invitation_id', invitationId)
      .eq('user_id', userId)
      .select();

    if (updateError) {
      console.error('[bailFromWorkout] Error updating response:', updateError);
      console.error('[bailFromWorkout] Error details:', JSON.stringify(updateError, null, 2));
      throw updateError;
    }

    if (!updatedResponse || updatedResponse.length === 0) {
      console.error('[bailFromWorkout] No rows updated - RLS policy may be blocking the update');
      throw new Error('Failed to update response: No rows were updated. This may be due to RLS policies.');
    }

    console.log(`[bailFromWorkout] Successfully updated response:`, updatedResponse);

    // Delete any workout_history entries for this user that match the invitation's schedule and time
    // This removes the workout from their schedule
    // Note: workout_history entries are typically created for the schedule owner, but we check
    // in case any were created for invited users
    if (invitation.schedule_id) {
      const { error: deleteError } = await supabase
        .from('workout_history')
        .delete()
        .eq('schedule_id', invitation.schedule_id)
        .eq('user_id', userId)
        .eq('status', 'planned'); // Only delete planned workouts, not completed ones

      if (deleteError) {
        console.error('Error deleting workout history entry:', deleteError);
        // Don't throw - the bail response was already updated, so continue
      }
    }

    // Send notification to all other participants about the bail
    await this.sendBailNotification(invitationId, userId, reason);
  }

  async cancelInvitation(invitationId: string, inviterId: string): Promise<void> {
    // Verify the user is the inviter
    const { data: invitation, error: fetchError } = await supabase
      .from('workout_invitations')
      .select('inviter_id')
      .eq('id', invitationId)
      .single();

    if (fetchError || !invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.inviter_id !== inviterId) {
      throw new Error('Only the inviter can cancel this invitation');
    }

    const { error } = await supabase
      .from('workout_invitations')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (error) throw error;

    // Send cancellation notifications
    await this.sendCancellationNotification(invitationId);
  }

  async getInvitationById(invitationId: string): Promise<WorkoutInvitationWithResponses | null> {
    const { data: invitation, error: invitationError } = await supabase
      .from('workout_invitations')
      .select(`
        *,
        users!workout_invitations_inviter_id_fkey (
          id, name, email, avatar
        ),
        gyms (
          id, name, address
        )
      `)
      .eq('id', invitationId)
      .single();

    if (invitationError) {
      if (invitationError.code === 'PGRST116') return null; // Not found
      throw invitationError;
    }

    // Get all responses for this invitation
    const { data: responses, error: responsesError } = await supabase
      .from('workout_invitation_responses')
      .select(`
        *,
        users (
          id, name, email, avatar
        )
      `)
      .eq('invitation_id', invitationId);

    if (responsesError) throw responsesError;

    // Transform responses and include user information
    const transformedResponses = (responses || []).map((dbResponse: any) => ({
      ...transformWorkoutInvitationResponseFromDB(dbResponse),
      user: dbResponse.users ? {
        id: dbResponse.users.id,
        name: dbResponse.users.name,
        email: dbResponse.users.email,
        avatar: dbResponse.users.avatar,
      } : undefined,
    }));

    return {
      ...transformWorkoutInvitationFromDB(invitation),
      responses: transformedResponses as any, // Type assertion needed since user is not in the type
      inviter: invitation.users,
      gym: invitation.gyms,
    };
  }

  private async sendInvitationNotifications(invitationId: string, invitedUserIds: string[]): Promise<void> {
    // Get invitation details for notification
    const invitation = await this.getInvitationById(invitationId);
    if (!invitation) return;

    // Send notifications to each invited user
    for (const userId of invitedUserIds) {
      try {
        await notificationService.sendNotification(userId, {
          title: `Workout Invitation from ${invitation.inviter.name}`,
          body: `You're invited to ${invitation.title} at ${invitation.gym.name}`,
          data: {
            type: 'workout_invitation',
            invitationId: invitationId,
            action: 'view_invitation'
          }
        });
      } catch (error) {
        console.error(`Failed to send invitation notification to user ${userId}:`, error);
      }
    }
  }

  private async sendResponseNotification(
    invitationId: string, 
    userId: string, 
    response: 'accepted' | 'declined'
  ): Promise<void> {
    const invitation = await this.getInvitationById(invitationId);
    if (!invitation) return;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (userError || !user) return;

    const action = response === 'accepted' ? 'accepted' : 'declined';
    const message = response === 'accepted' 
      ? `${user.name} accepted your invitation to ${invitation.title}`
      : `${user.name} declined your invitation to ${invitation.title}`;

    try {
      await notificationService.sendNotification(invitation.inviterId, {
        title: `Workout Invitation ${action}`,
        body: message,
        data: {
          type: 'workout_invitation_response',
          invitationId: invitationId,
          userId: userId,
          response: response
        }
      });
    } catch (error) {
      console.error(`Failed to send response notification to inviter:`, error);
    }
  }

  private async sendBailNotification(
    invitationId: string, 
    userId: string, 
    reason?: string
  ): Promise<void> {
    const invitation = await this.getInvitationById(invitationId);
    if (!invitation) return;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (userError || !user) return;

    // Get all other participants (excluding the person who bailed)
    const otherParticipants = invitation.responses
      .filter(r => r.userId !== userId && r.response === 'accepted')
      .map(r => r.userId);

    // Also notify the inviter if they're not the one who bailed
    if (invitation.inviterId !== userId) {
      otherParticipants.push(invitation.inviterId);
    }

    const reasonText = reason ? ` Reason: ${reason}` : '';
    const message = `${user.name} bailed from ${invitation.title}.${reasonText}`;

    // Send notifications to all other participants
    for (const participantId of otherParticipants) {
      try {
        await notificationService.sendNotification(participantId, {
          title: 'Workout Bail',
          body: message,
          data: {
            type: 'workout_bail',
            invitationId: invitationId,
            userId: userId,
            reason: reason
          }
        });
      } catch (error) {
        console.error(`Failed to send bail notification to user ${participantId}:`, error);
      }
    }
  }

  private async sendCancellationNotification(invitationId: string): Promise<void> {
    const invitation = await this.getInvitationById(invitationId);
    if (!invitation) return;

    // Get all participants who accepted
    const acceptedParticipants = invitation.responses
      .filter(r => r.response === 'accepted')
      .map(r => r.userId);

    const message = `${invitation.inviter.name} cancelled ${invitation.title}`;

    // Send notifications to all accepted participants
    for (const participantId of acceptedParticipants) {
      try {
        await notificationService.sendNotification(participantId, {
          title: 'Workout Cancelled',
          body: message,
          data: {
            type: 'workout_cancelled',
            invitationId: invitationId
          }
        });
      } catch (error) {
        console.error(`Failed to send cancellation notification to user ${participantId}:`, error);
      }
    }
  }

  // Helper method to get pending invitations count for a user
  async getPendingInvitationsCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('workout_invitation_responses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('response', 'pending');

    if (error) throw error;
    return count || 0;
  }

  // Helper method to get accepted invitations for a user (for calendar display)
  async getAcceptedInvitationsForUser(userId: string, startDate?: Date, endDate?: Date): Promise<WorkoutInvitationWithResponses[]> {
    let query = supabase
      .from('workout_invitation_responses')
      .select(`
        *,
        workout_invitations!inner (
          *,
          users!workout_invitations_inviter_id_fkey (
            id, name, email, avatar
          ),
          gyms (
            id, name, address
          )
        )
      `)
      .eq('user_id', userId)
      .eq('response', 'accepted')
      .eq('workout_invitations.status', 'active');

    if (startDate) {
      query = query.gte('workout_invitations.start_time', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('workout_invitations.start_time', endDate.toISOString());
    }

    const { data: responses, error } = await query.order('workout_invitations.start_time');

    if (error) throw error;

    const invitations: WorkoutInvitationWithResponses[] = [];
    
    for (const response of responses || []) {
      const invitation = response.workout_invitations;
      if (invitation) {
        // Get all responses for this invitation
        const { data: allResponses, error: allResponsesError } = await supabase
          .from('workout_invitation_responses')
          .select(`
            *,
            users (
              id, name, email, avatar
            )
          `)
          .eq('invitation_id', invitation.id);

        if (allResponsesError) throw allResponsesError;

        // Transform responses and include user information
        const transformedResponses = (allResponses || []).map((dbResponse: any) => ({
          ...transformWorkoutInvitationResponseFromDB(dbResponse),
          user: dbResponse.users ? {
            id: dbResponse.users.id,
            name: dbResponse.users.name,
            email: dbResponse.users.email,
            avatar: dbResponse.users.avatar,
          } : undefined,
        }));

        invitations.push({
          ...transformWorkoutInvitationFromDB(invitation),
          responses: transformedResponses as any,
          inviter: invitation.users,
          gym: invitation.gyms,
        });
      }
    }

    return invitations;
  }
}

export const workoutInvitationService = WorkoutInvitationService.getInstance();
