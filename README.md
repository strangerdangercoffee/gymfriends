# Gym Friends - React Native Expo App

A modern React Native app that helps friends coordinate gym visits by sharing schedules and real-time location updates.

## Features

### ✅ Core MVP Features
- **Schedule Management**: Create and manage workout schedules
- **Friend Network**: Add friends and see their gym activity
- **Gym Following**: Follow multiple gyms and see who's there
- **Real-time Presence**: Check in/out and see who's currently at the gym
- **Authentication**: Secure user authentication with Supabase
- **Location Services**: GPS tracking and automatic gym detection

### 🚧 Planned Features
- Push notifications for workout reminders
- Calendar integration with color-coded schedules
- Advanced privacy controls
- Gym discovery and search
- Workout type categorization

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Real-time + Auth)
- **Navigation**: React Navigation v6
- **State Management**: React Context API
- **Location**: Expo Location
- **Notifications**: Expo Notifications
- **UI Components**: Custom components with modern design

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── Input.tsx
├── context/            # Global state management
│   ├── AuthContext.tsx
│   ├── LocationContext.tsx
│   └── AppContext.tsx
├── navigation/         # Navigation configuration
│   └── AppNavigator.tsx
├── screens/           # Main app screens
│   ├── AuthScreen.tsx
│   ├── ScheduleScreen.tsx
│   ├── FriendsScreen.tsx
│   ├── GymsScreen.tsx
│   └── ProfileScreen.tsx
├── services/          # API and external services
│   ├── supabase.ts
│   ├── api.ts
│   ├── location.ts
│   └── notifications.ts
├── types/            # TypeScript type definitions
│   └── index.ts
└── utils/            # Helper functions
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd GymFriends
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Update `src/services/supabase.ts` with your credentials:

```typescript
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';
```

### 3. Set up Database Schema

Run the following SQL in your Supabase SQL editor:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Users table
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar TEXT,
  friends UUID[] DEFAULT '{}',
  followed_gyms UUID[] DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{"share_location": true, "share_schedule": true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Gyms table
CREATE TABLE gyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  followers UUID[] DEFAULT '{}',
  current_users UUID[] DEFAULT '{}',
  category TEXT CHECK (category IN ('traditional', 'climbing', 'specialty', 'crossfit', 'martial_arts')) DEFAULT 'traditional',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern TEXT CHECK (recurring_pattern IN ('daily', 'weekly', 'monthly')),
  workout_type TEXT,
  status TEXT CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'planned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Presence table
CREATE TABLE presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view gyms" ON gyms FOR SELECT USING (true);
CREATE POLICY "Anyone can view schedules" ON schedules FOR SELECT USING (true);
CREATE POLICY "Users can manage their own schedules" ON schedules FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view presence" ON presence FOR SELECT USING (true);
CREATE POLICY "Users can manage their own presence" ON presence FOR ALL USING (auth.uid() = user_id);

-- Enable real-time for tables
ALTER PUBLICATION supabase_realtime ADD TABLE gyms;
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
```

### 4. Seed Initial Data (Optional)

Add some sample gyms to get started:

```sql
INSERT INTO gyms (name, address, latitude, longitude, category) VALUES
('Planet Fitness Downtown', '123 Main St, Downtown', 40.7128, -74.0060, 'traditional'),
('Gold''s Gym Midtown', '456 Broadway, Midtown', 40.7589, -73.9851, 'traditional'),
('Movement Climbing', '789 Climb St, Brooklyn', 40.6782, -73.9442, 'climbing'),
('CrossFit Central', '321 Fitness Ave, Queens', 40.7282, -73.7949, 'crossfit');
```

### 5. Configure Expo Project

1. Update your Expo project ID in `src/services/notifications.ts`:
```typescript
const token = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-expo-project-id',
});
```

2. Configure app.json for location permissions:

```json

```

### 6. Run the App

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Development

### Adding New Features

1. **New Screens**: Add to `src/screens/` and update navigation
2. **New Components**: Add to `src/components/` for reusability
3. **API Functions**: Add to `src/services/api.ts`
4. **Types**: Add to `src/types/index.ts`

### Code Style

- Use TypeScript for all new code
- Follow React Native best practices
- Use functional components with hooks
- Implement proper error handling
- Add loading states for better UX

### Testing

```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint
```

## Deployment

### Expo Build

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

### App Store Deployment

1. Configure app.json with proper bundle identifiers
2. Build production versions
3. Submit to App Store Connect / Google Play Console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@gymfriends.app or create an issue in the repository.

