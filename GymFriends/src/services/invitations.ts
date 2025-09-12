import { supabase } from './supabase';
import { notificationService } from './notifications';

export interface FriendInvitation {
  id: string;
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface CreateInvitationData {
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
}

export class InvitationService {
  private static instance: InvitationService;

  static getInstance(): InvitationService {
    if (!InvitationService.instance) {
      InvitationService.instance = new InvitationService();
    }
    return InvitationService.instance;
  }

  async createInvitation(invitationData: CreateInvitationData): Promise<FriendInvitation> {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', invitationData.inviteeEmail)
      .single();

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('friend_invitations')
      .select('id')
      .eq('invitee_email', invitationData.inviteeEmail)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      throw new Error('Invitation already sent to this email');
    }

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const { data, error } = await supabase
      .from('friend_invitations')
      .insert([{
        inviter_id: invitationData.inviterId,
        inviter_name: invitationData.inviterName,
        inviter_email: invitationData.inviterEmail,
        invitee_email: invitationData.inviteeEmail,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    // Send invitation notification
    await this.sendInvitationNotification(data);

    return data;
  }

  async getPendingInvitations(inviteeEmail: string): Promise<FriendInvitation[]> {
    const { data, error } = await supabase
      .from('friend_invitations')
      .select('*')
      .eq('invitee_email', inviteeEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getSentInvitations(inviterId: string): Promise<FriendInvitation[]> {
    const { data, error } = await supabase
      .from('friend_invitations')
      .select('*')
      .eq('inviter_id', inviterId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async acceptInvitation(invitationId: string, inviteeId: string): Promise<void> {
    const { data: invitation, error: fetchError } = await supabase
      .from('friend_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchError || !invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending');
    }

    if (new Date() > new Date(invitation.expires_at)) {
      throw new Error('Invitation has expired');
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('friend_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (updateError) throw updateError;

    // Add both users as friends
    await this.addMutualFriendship(invitation.inviter_id, inviteeId);

    // Send notification to inviter
    await this.sendInvitationAcceptedNotification(invitation);
  }

  async declineInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('friend_invitations')
      .update({
        status: 'declined',
      })
      .eq('id', invitationId);

    if (error) throw error;
  }

  async cancelInvitation(invitationId: string, inviterId: string): Promise<void> {
    const { error } = await supabase
      .from('friend_invitations')
      .update({
        status: 'declined',
      })
      .eq('id', invitationId)
      .eq('inviter_id', inviterId);

    if (error) throw error;
  }

  private async addMutualFriendship(userId1: string, userId2: string): Promise<void> {
    // Add user2 to user1's friends list
    const { data: user1 } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId1)
      .single();

    const updatedFriends1 = [...(user1?.friends || []), userId2];

    await supabase
      .from('users')
      .update({ 
        friends: updatedFriends1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId1);

    // Add user1 to user2's friends list
    const { data: user2 } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId2)
      .single();

    const updatedFriends2 = [...(user2?.friends || []), userId1];

    await supabase
      .from('users')
      .update({ 
        friends: updatedFriends2,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId2);
  }

  private async sendInvitationNotification(invitation: FriendInvitation): Promise<void> {
    // In a real app, you would send an email or push notification here
    // For now, we'll just log it
    console.log(`Invitation sent to ${invitation.invitee_email} from ${invitation.inviter_name}`);
    
    // You could integrate with email services like SendGrid, AWS SES, etc.
    // or use Expo's notification system for in-app notifications
  }

  private async sendInvitationAcceptedNotification(invitation: FriendInvitation): Promise<void> {
    // Send notification to the inviter that their invitation was accepted
    console.log(`Invitation accepted by ${invitation.invitee_email}`);
    
    // You could send a push notification here
  }

  async cleanupExpiredInvitations(): Promise<void> {
    const { error } = await supabase
      .from('friend_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
  }
}

export const invitationService = InvitationService.getInstance();

