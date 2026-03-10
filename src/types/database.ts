// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          avatar: string | null;
          friends: string[];
          followed_gyms: string[];
          privacy_settings: {
            share_location: boolean;
            share_schedule: boolean;
          };
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          avatar?: string | null;
          friends?: string[];
          followed_gyms?: string[];
          privacy_settings?: {
            share_location: boolean;
            share_schedule: boolean;
          };
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          avatar?: string | null;
          friends?: string[];
          followed_gyms?: string[];
          privacy_settings?: {
            share_location: boolean;
            share_schedule: boolean;
          };
          created_at?: string;
          updated_at?: string;
        };
      };
      gyms: {
        Row: {
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          followers: string[] | null;
          current_users: string[] | null;
          category: 'traditional' | 'climbing' | 'specialty' | 'crossfit' | 'martial_arts';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          followers?: string[] | null;
          current_users?: string[] | null;
          category: 'traditional' | 'climbing' | 'specialty' | 'crossfit' | 'martial_arts';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          followers?: string[] | null;
          current_users?: string[] | null;
          category?: 'traditional' | 'climbing' | 'specialty' | 'crossfit' | 'martial_arts';
          created_at?: string;
          updated_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          start_time: string;
          end_time: string;
          is_recurring: boolean;
          recurring_pattern: 'daily' | 'weekly' | 'monthly' | null;
          workout_type: string | null;
          status: 'planned' | 'active' | 'completed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          start_time: string;
          end_time: string;
          is_recurring?: boolean;
          recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null;
          workout_type?: string | null;
          status?: 'planned' | 'active' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          gym_id?: string;
          start_time?: string;
          end_time?: string;
          is_recurring?: boolean;
          recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null;
          workout_type?: string | null;
          status?: 'planned' | 'active' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
      };
      presence: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          checked_in_at: string;
          checked_out_at: string | null;
          is_active: boolean;
          location: {
            latitude: number;
            longitude: number;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          checked_in_at: string;
          checked_out_at?: string | null;
          is_active?: boolean;
          location?: {
            latitude: number;
            longitude: number;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          gym_id?: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
          is_active?: boolean;
          location?: {
            latitude: number;
            longitude: number;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      friend_invitations: {
        Row: {
          id: string;
          inviter_id: string;
          inviter_name: string;
          inviter_email: string;
          invitee_email: string | null;
          invitee_phone: string | null;
          status: 'pending' | 'accepted' | 'declined' | 'expired';
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          inviter_name: string;
          inviter_email: string;
          invitee_email?: string | null;
          invitee_phone?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'expired';
          created_at?: string;
          expires_at: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          inviter_id?: string;
          inviter_name?: string;
          inviter_email?: string;
          invitee_email?: string | null;
          invitee_phone?: string | null;
          status?: 'pending' | 'accepted' | 'declined' | 'expired';
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
        };
      };
      workout_invitations: {
        Row: {
          id: string;
          inviter_id: string;
          schedule_id: string;
          title: string;
          description: string | null;
          gym_id: string;
          start_time: string;
          end_time: string;
          is_recurring: boolean;
          recurring_pattern: 'daily' | 'weekly' | 'monthly' | null;
          workout_type: string | null;
          status: 'active' | 'cancelled' | 'completed';
          created_at: string;
          updated_at: string;
          associated_group_ids: string[] | null;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          schedule_id: string;
          title: string;
          description?: string | null;
          gym_id: string;
          start_time: string;
          end_time: string;
          is_recurring?: boolean;
          recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null;
          workout_type?: string | null;
          status?: 'active' | 'cancelled' | 'completed';
          created_at?: string;
          updated_at?: string;
          associated_group_ids?: string[] | null;
        };
        Update: {
          id?: string;
          inviter_id?: string;
          schedule_id?: string;
          title?: string;
          description?: string | null;
          gym_id?: string;
          start_time?: string;
          end_time?: string;
          is_recurring?: boolean;
          recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null;
          workout_type?: string | null;
          status?: 'active' | 'cancelled' | 'completed';
          created_at?: string;
          updated_at?: string;
          associated_group_ids?: string[] | null;
        };
      };
      workout_invitation_responses: {
        Row: {
          id: string;
          invitation_id: string;
          user_id: string;
          response: 'pending' | 'accepted' | 'declined' | 'bailed';
          bailed_at: string | null;
          bail_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          user_id: string;
          response?: 'pending' | 'accepted' | 'declined' | 'bailed';
          bailed_at?: string | null;
          bail_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invitation_id?: string;
          user_id?: string;
          response?: 'pending' | 'accepted' | 'declined' | 'bailed';
          bailed_at?: string | null;
          bail_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_gym_follows: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          gym_id?: string;
          created_at?: string;
        };
      };
      user_gym_presence: {
        Row: {
          id: string;
          user_id: string;
          gym_id: string;
          checked_in_at: string;
          checked_out_at: string | null;
          is_active: boolean;
          location: {
            latitude: number;
            longitude: number;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gym_id: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
          is_active?: boolean;
          location?: {
            latitude: number;
            longitude: number;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          gym_id?: string;
          checked_in_at?: string;
          checked_out_at?: string | null;
          is_active?: boolean;
          location?: {
            latitude: number;
            longitude: number;
          } | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          created_at?: string;
        };
      };
    };
  };
}
