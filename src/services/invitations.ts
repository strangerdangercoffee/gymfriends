import { supabase } from './supabase';
import { notificationService } from './notifications';

export interface FriendInvitation {
  id: string;
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface CreateInvitationData {
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  /** Phone-only: normalized (digits-only) for storage and matching */
  inviteePhone: string;
}

export class InvitationService {
  private static instance: InvitationService;

  static getInstance(): InvitationService {
    if (!InvitationService.instance) {
      InvitationService.instance = new InvitationService();
    }
    return InvitationService.instance;
  }

  /** Normalize phone to digits-only (same as users.phone and addFriend lookup) */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async createInvitation(invitationData: CreateInvitationData): Promise<FriendInvitation> {
    const normalizedPhone = this.normalizePhone(invitationData.inviteePhone);
    if (!normalizedPhone.length) {
      throw new Error('A valid phone number is required');
    }

    // Check if user already exists with this phone
    const { data: existingUserByPhone } = await supabase
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingUserByPhone) {
      throw new Error('User already has an account with this phone number');
    }

    // Check if there's already a pending invitation to this phone
    const { data: existingInvitation } = await supabase
      .from('friend_invitations')
      .select('id')
      .eq('invitee_phone', normalizedPhone)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvitation) {
      throw new Error('Invitation already sent to this phone number');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const { data, error } = await supabase
      .from('friend_invitations')
      .insert([{
        inviter_id: invitationData.inviterId,
        inviter_name: invitationData.inviterName,
        inviter_email: invitationData.inviterEmail,
        invitee_email: null,
        invitee_phone: normalizedPhone,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    await this.sendInvitationNotification(data);
    return data;
  }

  /** Get pending invitations for a phone number (normalized digits-only). */
  async getPendingInvitations(inviteePhone: string): Promise<FriendInvitation[]> {
    const normalized = this.normalizePhone(inviteePhone);
    if (!normalized.length) {
      return [];
    }
    const { data, error } = await supabase
      .from('friend_invitations')
      .select('*')
      .eq('status', 'pending')
      .eq('invitee_phone', normalized)
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
    const { error } = await (supabase as any)
      .from('user_friendships')
      .insert([
        { user_id: userId1, friend_id: userId2 },
        { user_id: userId2, friend_id: userId1 },
      ]);
    if (error) throw error;
  }

  private async sendInvitationNotification(invitation: FriendInvitation): Promise<void> {
    if (invitation.invitee_email) {
      console.log(`Invitation sent to ${invitation.invitee_email} from ${invitation.inviter_name}`);
      // Email integration (SendGrid, AWS SES, etc.) can be added here
    } else if (invitation.invitee_phone) {
      await this.sendInvitationSms(invitation);
    }
  }

  /**
   * Sends the invitation SMS via Supabase Edge Function (Twilio).
   * The Edge Function must be deployed and Twilio secrets configured; see docs/SMS_INVITATION_INTEGRATION.md
   */
  private async sendInvitationSms(invitation: FriendInvitation): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('send-invitation-sms', {
        body: { invitationId: invitation.id },
      });
      if (error) {
        console.warn('SMS invitation: Edge Function error', error);
      }
    } catch (e) {
      console.warn('SMS invitation: failed to invoke Edge Function', e);
    }
  }

  private async sendInvitationAcceptedNotification(invitation: FriendInvitation): Promise<void> {
    // Send notification to the inviter that their invitation was accepted
    const contact = invitation.invitee_email || invitation.invitee_phone || 'unknown';
    console.log(`Invitation accepted by ${contact}`);
    
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

