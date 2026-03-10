// User types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  friends: string[]; // array of user IDs
  followedGyms: string[]; // array of gym IDs
  privacySettings: {
    shareLocation: boolean;
    shareSchedule: boolean;
    autoCheckIn: boolean;
  };
  climbingProfile?: ClimbingProfile; // Optional climbing profile
  createdAt: string;
  updatedAt: string;
}

// Gym types
export interface Gym {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  followers: string[]; // user IDs who follow this gym
  currentUsers: string[]; // users currently at this gym
  category: 'traditional' | 'climbing' | 'specialty' | 'crossfit' | 'martial_arts';
  createdAt: string;
  updatedAt: string;
}

// Schedule types
export interface Schedule {
  id: string;
  userId: string;
  gymId: string;
  startTime: string; // ISO timestamp
  endTime: string; // ISO timestamp
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'custom';
  workoutType?: string;
  title?: string;
  notes?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// Climbing area (outdoor crag) types
export interface ClimbingArea {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
  region?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAreaVisit {
  id: string;
  userId: string;
  areaId: string;
  firstEnteredAt: string;
  lastSeenAt: string;
  leftAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAreaPlan {
  id: string;
  userId: string;
  areaId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  inviteeUserId: string;
  inviterUserId: string;
  status: 'invited' | 'accepted' | 'declined';
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

// Presence types
export interface Presence {
  id: string;
  userId: string;
  gymId: string;
  checkedInAt: string; // ISO timestamp
  checkedOutAt?: string; // ISO timestamp
  isActive: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Workout History types
export interface WorkoutHistory {
  id: string;
  userId: string;
  gymId: string;
  startTime: string; // ISO timestamp (from checkedInAt)
  endTime: string; // ISO timestamp (from checkedOutAt)
  duration: number; // Duration in minutes
  workoutType?: 'limit' | 'power' | 'endurance' | 'technique' | 'volume' | 'projecting' | 'recovery' | 'cardio';
  climbingType?: 'lead' | 'top_rope' | 'bouldering' | 'any';
  title?: string;
  notes?: string;
  exercises?: WorkoutExercise[];
  presenceId?: string; // Reference to the presence record
  scheduleId?: string; // Reference to the schedule (null for standalone)
  isException?: boolean; // True if modified from recurring pattern
  isRecurring?: boolean; // True if this workout is part of a recurring schedule
  status: 'planned' | 'completed' | 'cancelled'; // Workout status
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number; // in minutes
  distance?: number; // in km or miles
  notes?: string;
}

// Navigation types
export type RootTabParamList = {
  Schedule: undefined;
  Friends: undefined; // Now shows ConnectionsScreen with Friends/Groups tabs
  Map: undefined;
  Feed: undefined;
  Profile: undefined;
};

export type MapStackParamList = {
  MapMain: undefined;
  AreaDetail: { areaId: string };
};

export type ScheduleStackParamList = {
  ScheduleMain: undefined;
  AddSchedule: undefined;
};

export type GroupsStackParamList = {
  GroupsMain: undefined;
  GroupChat: { groupId: string; groupName: string };
  AreaFeed: undefined;
  AreasMap: undefined;
  AreaDetail: { areaId: string };
};

// Component props types
export interface GymCardProps {
  gym: Gym;
  onPress: () => void;
  showCurrentUsers?: boolean;
}

export interface ScheduleCardProps {
  schedule: Schedule;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export interface FriendCardProps {
  user: User;
  isAtGym?: boolean;
  currentGym?: Gym;
  onPress: () => void;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Location types
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

// Notification types
export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Form types
export interface CreateScheduleForm {
  gymId: string;
  startTime: Date;
  endTime: Date;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'custom';
  workoutType?: string;
  title?: string;
  notes?: string;
}

export interface AddFriendForm {
  email: string;
}

// Workout Invitation types
export interface WorkoutInvitation {
  id: string;
  inviterId: string;
  scheduleId: string;
  title: string;
  description?: string;
  gymId: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  workoutType?: string;
  status: 'active' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
  associatedGroupIds?: string[];
}

export interface WorkoutInvitationResponse {
  id: string;
  invitationId: string;
  userId: string;
  response: 'pending' | 'accepted' | 'declined' | 'bailed';
  bailedAt?: string;
  bailReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutInvitationWithResponses extends WorkoutInvitation {
  responses: WorkoutInvitationResponse[];
  inviter: User;
  gym: Gym;
}

export interface CreateWorkoutInvitationData {
  scheduleId: string;
  title: string;
  description?: string;
  gymId: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  workoutType?: string;
  invitedUserIds: string[];
  associatedGroupIds?: string[];
}

export interface CreateGymForm {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: Gym['category'];
}

// Calendar types
export interface WorkoutSession {
  id: string;
  startTime: Date;
  endTime: Date;
  workoutType: 'limit' | 'power' | 'endurance' | 'technique' | 'volume' | 'projecting' | 'recovery' | 'cardio';
  climbingType: 'lead' | 'top_rope' | 'bouldering' | 'any';
  title: string;
  notes?: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  gymId?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'custom';
  interval: number; // For custom: every X days
  endDate?: Date;
  daysOfWeek?: number[]; // For weekly: [1,3,5] for Mon,Wed,Fri
}

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  hasWorkouts: boolean;
  workouts: WorkoutSession[];
  isWeekend: boolean;
  isPast: boolean;
}

export interface TimeSlot {
  hour: number;
  minute: number;
  isSelected: boolean;
  hasWorkout: boolean;
  workout?: WorkoutSession;
}

export interface CalendarView {
  type: 'today' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
}

export interface TimeSelection {
  isSelecting: boolean;
  startDate: Date;
  startHour: number;
  startMinute: number;
  endDate: Date;
  endHour: number;
  endMinute: number;
  isDragging: boolean;
}

// Context types
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface LocationContextType {
  currentLocation: LocationData | null;
  isTracking: boolean;
  isGeofencingActive: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  startGeofencing: (userId: string, followedGyms: Gym[], options?: { userName?: string; followedAreas?: ClimbingArea[]; allClimbingAreas?: ClimbingArea[] }) => Promise<void>;
  stopGeofencing: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
  hasBackgroundPermission: boolean;
}

export interface AppContextType {
  schedules: Schedule[];
  gyms: Gym[];
  friends: User[];
  presence: Presence[];
  workoutHistory: WorkoutHistory[];
  workoutInvitations: WorkoutInvitationWithResponses[];
  pendingInvitationsCount: number;
  followedGyms: Gym[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshWorkoutHistory: () => Promise<void>;
  addSchedule: (schedule: CreateScheduleForm) => Promise<Schedule>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  deleteRecurringSchedule: (userId: string, workoutType: string, recurringPattern: any, startTime: string) => Promise<void>;
  addFriend: (email: string) => Promise<void>;
  addFriendInstant: (friendId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  followGym: (gymId: string) => Promise<void>;
  unfollowGym: (gymId: string) => Promise<void>;
  checkIn: (gymId: string) => Promise<void>;
  checkOut: (gymId: string) => Promise<void>;
  getWorkoutHistory: (userId: string, startDate?: Date, endDate?: Date) => Promise<WorkoutHistory[]>;
  updateWorkoutHistory: (id: string, updates: Partial<WorkoutHistory>) => Promise<void>;
  deleteWorkoutHistory: (id: string) => Promise<void>;
  refreshWorkoutInvitations: () => Promise<void>;
  createWorkoutInvitation: (scheduleId: string, invitationData: CreateWorkoutInvitationData) => Promise<void>;
  respondToWorkoutInvitation: (invitationId: string, response: 'accepted' | 'declined') => Promise<void>;
  bailFromWorkout: (invitationId: string, reason?: string) => Promise<void>;
  cancelWorkoutInvitation: (invitationId: string) => Promise<void>;
  getWorkoutInvitationById: (invitationId: string) => Promise<WorkoutInvitationWithResponses | null>;
  climbingAreas: ClimbingArea[];
  followedAreas: ClimbingArea[];
  followArea: (areaId: string) => Promise<void>;
  unfollowArea: (areaId: string) => Promise<void>;
}

// Group Chat types
export interface GroupChat {
  chatId: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderUserId: string;
  senderName?: string; // Populated when fetching with user data
  senderAvatar?: string; // Populated when fetching with user data
  messageText: string;
  messageType: 'text' | 'image' | 'video' | 'workout-share' | 'system';
  metadata?: {
    imageUrl?: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    workoutId?: string;
    workoutTitle?: string;
    action?: string; // For system messages (e.g., 'belayer_request')
    userId?: string; // For system messages
    senderUserId?: string; // For belayer request messages (author user ID)
    postId?: string; // For belayer request messages
    postType?: 'belayer_request' | 'rally_pads_request';
    climbingType?: 'lead' | 'top_rope' | 'bouldering' | 'any';
    scheduledTime?: string;
    gymName?: string;
    cragName?: string;
    targetRoute?: string;
    targetGrade?: string;
  };
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  readBy?: string[]; // Array of user IDs who have read this message
}

export interface ChatMessageRead {
  readId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// Climbing Profile types
export interface ClimbingProfile {
  profileId: string;
  userId: string;
  leadClimbing: boolean;
  leadGradeSystem?: 'yds' | 'french' | 'aus';
  leadGradeMin?: string;
  leadGradeMax?: string;
  topRope: boolean;
  topRopeGradeSystem?: 'yds' | 'french' | 'aus';
  topRopeGradeMin?: string;
  topRopeGradeMax?: string;
  bouldering: boolean;
  boulderGradeSystem?: 'v_scale' | 'font';
  boulderMaxFlash?: string;
  boulderMaxSend?: string;
  traditionalClimbing: boolean;
  traditionalGradeSystem?: 'yds' | 'french' | 'aus';
  traditionalGradeMin?: string;
  traditionalGradeMax?: string;
  openToNewPartners: boolean;
  preferredGradeRangeMin?: string;
  preferredGradeRangeMax?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BelayCertification {
  certificationId: string;
  userId: string;
  gymId: string;
  gymName?: string; // Populated when fetching
  certificationType: 'top_rope' | 'lead' | 'both';
  certifiedAt: string;
  expiresAt?: string;
  verifiedByGym: boolean;
}

export interface AreaFeedPost {
  postId: string;
  authorUserId: string;
  authorName?: string; // Populated when fetching
  authorAvatar?: string; // Populated when fetching
  gymId?: string;
  gymName?: string; // Populated when fetching
  areaId?: string;
  areaName?: string; // Populated when fetching (climbing area)
  cragName?: string; // Legacy, prefer areaId/areaName
  postType: 'belayer_request' | 'rally_pads_request' | 'lost_found' | 'discussion' | 'general' | 'trip_announcement';
  title: string;
  content: string;
  climbingType?: 'lead' | 'top_rope' | 'bouldering' | 'any';
  targetRoute?: string;
  targetGrade?: string;
  scheduledTime?: string; // ISO timestamp, null for "now"
  urgency: 'now' | 'scheduled';
  reportCount: number;
  quarantined: boolean;
  metadata?: Record<string, any>;
  responseCount?: number; // Populated when fetching
  availableResponders?: BelayerRequestResponse[]; // For inviter view
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BelayerRequestResponse {
  responseId: string;
  postId: string;
  responderUserId: string;
  responderName?: string; // Populated when fetching
  responderAvatar?: string; // Populated when fetching
  responderProfile?: ClimbingProfile; // For matching info
  status: 'available' | 'selected' | 'declined' | 'completed';
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostReport {
  reportId: string;
  postId: string;
  reporterUserId: string;
  reason: string;
  createdAt: string;
}

export interface NotificationPreferences {
  preferenceId: string;
  userId: string;
  // Workout notifications
  workoutInvitations: boolean;
  workoutResponses: boolean;
  workoutBails: boolean;
  workoutReminders: boolean;
  // Social notifications
  friendAtGym: boolean;
  friendAtCrag: boolean;
  groupMessages: boolean;
  // Belayer/climbing partner notifications
  belayerRequests: boolean;
  belayerResponses: boolean;
  matchingPartners: boolean;
  groupBelayerAlerts: boolean;
  // Feed notifications
  feedResponses: boolean;
  feedMentions: boolean;
  // Trip planning
  friendTripAnnouncements: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBelayerRequestData {
  gymId?: string;
  areaId?: string;
  cragName?: string; // Legacy
  postType: 'belayer_request' | 'rally_pads_request';
  title: string;
  content: string;
  climbingType: 'lead' | 'top_rope' | 'bouldering' | 'any';
  targetRoute?: string;
  targetGrade?: string;
  scheduledTime?: string; // ISO timestamp, null for "now"
  urgency: 'now' | 'scheduled';
  audienceGroups?: string[]; // Group IDs to post to
  audienceArea?: 'gym' | 'crag'; // Post to gym/crag feed (optional)
}
