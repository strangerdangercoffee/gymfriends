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
  };
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
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  workoutType?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
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

// Navigation types
export type RootTabParamList = {
  Schedule: undefined;
  Friends: undefined;
  Gyms: undefined;
  Profile: undefined;
};

export type ScheduleStackParamList = {
  ScheduleMain: undefined;
  AddSchedule: undefined;
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
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  workoutType?: string;
}

export interface AddFriendForm {
  email: string;
}

export interface CreateGymForm {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: Gym['category'];
}

// Context types
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export interface LocationContextType {
  currentLocation: LocationData | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
}

export interface AppContextType {
  schedules: Schedule[];
  gyms: Gym[];
  friends: User[];
  presence: Presence[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  addSchedule: (schedule: CreateScheduleForm) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  addFriend: (email: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  followGym: (gymId: string) => Promise<void>;
  unfollowGym: (gymId: string) => Promise<void>;
  checkIn: (gymId: string) => Promise<void>;
  checkOut: (gymId: string) => Promise<void>;
}

