# Development Guide - Gym Friends App

## Quick Start

1. **Install dependencies**: `npm install`
2. **Set up Supabase**: Follow the README setup instructions
3. **Start development**: `npm start`
4. **Open in simulator**: Press `i` for iOS or `a` for Android

## Project Architecture

### State Management
- **AuthContext**: Handles user authentication and profile data
- **LocationContext**: Manages GPS tracking and location permissions
- **AppContext**: Manages app data (schedules, gyms, friends, presence)

### Data Flow
1. User actions trigger context methods
2. Context methods call API services
3. API services interact with Supabase
4. Real-time updates via Supabase subscriptions
5. UI automatically re-renders with new data

### Key Components

#### Screens
- **AuthScreen**: Login/signup with form validation
- **ScheduleScreen**: Manage workout schedules with time filters
- **FriendsScreen**: View friends' gym activity in real-time
- **GymsScreen**: Browse and follow gyms, check in/out
- **ProfileScreen**: User settings and privacy controls

#### Services
- **supabase.ts**: Database client configuration
- **api.ts**: All database operations (CRUD for users, gyms, schedules, presence)
- **location.ts**: GPS tracking, geofencing, distance calculations
- **notifications.ts**: Push notifications and local notifications

## Development Workflow

### Adding New Features

1. **Define Types**: Add interfaces to `src/types/index.ts`
2. **Create API Functions**: Add to `src/services/api.ts`
3. **Update Context**: Add methods to relevant context
4. **Build UI**: Create screens/components
5. **Test**: Use Expo Go app or simulators

### Database Schema Updates

1. Update SQL schema in Supabase dashboard
2. Update TypeScript types in `src/types/index.ts`
3. Update API functions in `src/services/api.ts`
4. Test with sample data

### Real-time Features

The app uses Supabase real-time subscriptions for:
- Live presence updates (who's at the gym)
- Schedule changes
- Gym follower updates

Example subscription setup:
```typescript
const subscription = supabase
  .channel('presence')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'presence',
  }, (payload) => {
    // Handle real-time updates
  })
  .subscribe();
```

## Testing

### Manual Testing Checklist

#### Authentication
- [ ] Sign up with valid email/password
- [ ] Sign in with existing credentials
- [ ] Sign out functionality
- [ ] Form validation (empty fields, invalid email)

#### Schedule Management
- [ ] Create new workout schedule
- [ ] Edit existing schedule
- [ ] Delete schedule
- [ ] Filter by time range (today/week/month)
- [ ] Recurring schedule options

#### Friends
- [ ] Add friend by email
- [ ] Remove friend
- [ ] View friends at gym vs not at gym
- [ ] Real-time updates when friends check in/out

#### Gyms
- [ ] Browse all gyms
- [ ] Filter by category
- [ ] Follow/unfollow gyms
- [ ] Check in/out functionality
- [ ] View current users at gym

#### Location Services
- [ ] Request location permissions
- [ ] Manual check in/out
- [ ] Automatic gym detection (when implemented)
- [ ] Privacy settings

#### Profile
- [ ] Edit profile information
- [ ] Update privacy settings
- [ ] View stats (friends, gyms, workouts)
- [ ] Location permission status

### Common Issues

#### Location Permissions
- iOS: Requires `NSLocationWhenInUseUsageDescription` in Info.plist
- Android: Requires `ACCESS_FINE_LOCATION` permission
- Test on physical device for accurate location services

#### Supabase Connection
- Verify project URL and anon key
- Check RLS policies are correctly set
- Ensure real-time is enabled for tables

#### Navigation
- Tab navigation works with authentication state
- Loading states during auth checks
- Proper error handling for network issues

## Performance Considerations

### Optimization Tips
1. **Lazy Loading**: Load gym data only when needed
2. **Caching**: Use AsyncStorage for offline data
3. **Real-time**: Limit subscriptions to necessary data
4. **Location**: Use appropriate accuracy levels
5. **Images**: Optimize avatar and gym images

### Memory Management
- Clean up subscriptions in useEffect cleanup
- Limit location tracking when app is backgrounded
- Use proper loading states to prevent memory leaks

## Deployment

### Pre-deployment Checklist
- [ ] Update app.json with production settings
- [ ] Configure proper bundle identifiers
- [ ] Set up production Supabase project
- [ ] Test on physical devices
- [ ] Verify all permissions work correctly
- [ ] Test offline functionality

### Environment Configuration
```typescript
// Use environment variables for different builds
const supabaseUrl = __DEV__ 
  ? 'https://dev-project.supabase.co'
  : 'https://prod-project.supabase.co';
```

## Troubleshooting

### Common Errors

#### "Network request failed"
- Check Supabase URL and key
- Verify internet connection
- Check RLS policies

#### "Location permission denied"
- Test on physical device
- Check permission strings in app.json
- Verify location services are enabled

#### "Real-time not working"
- Check Supabase real-time is enabled
- Verify table is added to publication
- Check subscription setup

### Debug Tools
- React Native Debugger
- Supabase dashboard logs
- Expo development tools
- Device logs (Xcode/Android Studio)

## Contributing

### Code Style
- Use TypeScript for all new code
- Follow existing component patterns
- Add proper error handling
- Include loading states
- Write descriptive commit messages

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation if needed
4. Submit PR with clear description
5. Address review feedback

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Location](https://github.com/expo/expo/tree/main/packages/expo-location)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

