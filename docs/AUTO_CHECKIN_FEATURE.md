# Auto Check-In Feature

## Overview

The Auto Check-In feature allows users to be automatically checked in to their gym when they are within 500 feet (152.4 meters) of the gym's location. This feature uses background location tracking and geofencing to provide a seamless experience.

## How It Works

### Geofencing

1. **Check-In Radius**: 500 feet (152.4 meters)
2. **Check-Out Radius**: 656 feet (200 meters) - provides buffer to prevent rapid check-in/check-out cycles
3. **Location Updates**: Every 30 seconds or when user moves 50 meters
4. **Background Tracking**: Runs even when the app is closed or in the background

### User Flow

1. User enables Auto Check-In in Profile Settings
2. App requests background location permissions (if not already granted)
3. Permission modal explains:
   - Why we need background location
   - What data is collected
   - Privacy protections
   - Platform-specific instructions
4. Once granted, geofencing service starts monitoring
5. When user enters a gym's geofence:
   - User is automatically checked in
   - Presence record is created
   - Gym's current users list is updated
   - Optional: Push notification sent to user
6. When user leaves the gym (beyond 200m):
   - User is automatically checked out
   - Presence record is marked inactive
   - Gym's current users list is updated

## Technical Implementation

### Components

#### 1. GeofencingService (`src/services/geofencing.ts`)

- Manages background location tracking using Expo Task Manager
- Monitors user's distance from followed gyms
- Triggers automatic check-in/check-out
- Maintains state to prevent duplicate operations

**Key Methods:**
- `startGeofencing(userId, followedGyms)`: Starts background monitoring
- `stopGeofencing()`: Stops background monitoring
- `updateFollowedGyms(gyms)`: Updates the list of monitored gyms
- `setManualCheckInState(gymId, isCheckedIn)`: Syncs manual check-ins with geofencing

#### 2. LocationPermissionModal (`src/components/LocationPermissionModal.tsx`)

Beautiful modal that:
- Explains the feature benefits
- Shows privacy guarantees
- Provides platform-specific instructions
- Displays success state when permissions granted

#### 3. LocationContext Updates

Added methods:
- `startGeofencing(userId, followedGyms)`
- `stopGeofencing()`
- `hasBackgroundPermission` (state)
- `isGeofencingActive` (state)

#### 4. AppContext Integration

- Automatically starts geofencing when:
  - User enables auto check-in
  - User has background location permission
  - User has followed gyms
- Stops geofencing when user disables the feature
- Updates geofencing when user follows/unfollows gyms
- Syncs manual check-in/check-out with geofencing state

#### 5. ProfileScreen Updates

New UI elements:
- Auto Check-In toggle switch in Privacy Settings
- Active status indicator when geofencing is running
- Automatic permission modal trigger
- Immediate save on toggle (no need to press Save button)

## Privacy & Permissions

### iOS

Requires two permission levels:
1. **Foreground Location** (`When In Use`)
2. **Background Location** (`Always`)

User sees Apple's system prompts:
1. First prompt: "Allow While Using App" or "Allow Once"
2. Second prompt (appears after granting foreground): "Change to Always Allow"

### Android

Single permission:
- **Background Location** (`Allow all the time`)

User may also need to grant:
- Precise location access
- Physical activity recognition (Android 10+)

## Database Schema

### Users Table - Privacy Settings

```json
{
  "share_location": boolean,
  "share_schedule": boolean,
  "auto_check_in": boolean
}
```

Run migration:
```bash
# Apply SQL migration
psql your_database < scripts/add-auto-checkin-setting.sql
```

## Configuration

### Geofencing Parameters

Located in `src/services/geofencing.ts`:

```typescript
const CHECK_IN_RADIUS_METERS = 152.4; // 500 feet
const CHECK_OUT_RADIUS_METERS = 200;  // 656 feet

// Background location update settings
{
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 30000,        // 30 seconds
  distanceInterval: 50,       // 50 meters
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
}
```

### Customization Options

To adjust the geofencing behavior:

1. **Change check-in radius**:
   ```typescript
   const CHECK_IN_RADIUS_METERS = 200; // ~656 feet
   ```

2. **Adjust update frequency**:
   ```typescript
   timeInterval: 60000, // Check every 60 seconds instead of 30
   ```

3. **Change accuracy** (affects battery usage):
   ```typescript
   accuracy: Location.Accuracy.Low,      // Least accurate, best battery
   accuracy: Location.Accuracy.Balanced, // Default - good balance
   accuracy: Location.Accuracy.High,     // Most accurate, worst battery
   ```

## Testing

### Manual Testing

1. **Enable Feature**:
   - Go to Profile > Privacy Settings
   - Toggle "Auto Check-In"
   - Grant background location permissions

2. **Test Check-In**:
   - Follow a gym in the Gyms screen
   - Travel to within 500ft of that gym
   - Wait up to 30 seconds
   - Verify automatic check-in occurs

3. **Test Check-Out**:
   - Move more than 656ft away from gym
   - Wait up to 30 seconds
   - Verify automatic check-out occurs

4. **Test Permission Flow**:
   - Fresh install the app
   - Try to enable Auto Check-In
   - Verify permission modal appears
   - Grant permissions
   - Verify toggle enables automatically

### Debugging

Check logs for:
```
Auto checked in to gym: [gymId]
Auto checked out from gym: [gymId]
Geofencing started
Geofencing stopped
```

## Known Limitations

1. **Battery Usage**: Background location tracking consumes battery
2. **Location Accuracy**: May vary based on device, GPS signal, and accuracy setting
3. **iOS Restrictions**: Apple may terminate background tasks after extended periods
4. **Network Required**: Check-in/check-out requires internet connection
5. **Permissions**: Users can revoke permissions at any time via system settings

## Future Enhancements

1. **Smart Notifications**:
   - Notify user when auto checked-in
   - Remind user if they forget to check out

2. **Check-In History**:
   - View all auto check-ins
   - Analytics on gym visit patterns

3. **Gym Crowding Alerts**:
   - Notify user if their gym is crowded
   - Suggest optimal visit times

4. **Battery Optimization**:
   - Adjust update frequency based on battery level
   - Pause geofencing when battery is low

5. **Multiple Gym Support**:
   - Handle check-in to multiple nearby gyms
   - Priority system for overlapping gym areas

## Troubleshooting

### Auto Check-In Not Working

1. **Check permissions**:
   - iOS: Settings > GymFriends > Location > Always
   - Android: Settings > Apps > GymFriends > Permissions > Location > Allow all the time

2. **Verify gyms are followed**:
   - Go to Gyms screen
   - Ensure desired gyms are followed

3. **Check geofencing status**:
   - Go to Profile screen
   - Look for "Active" indicator under Auto Check-In

4. **Restart geofencing**:
   - Toggle Auto Check-In off
   - Wait 5 seconds
   - Toggle Auto Check-In on

### Permissions Not Requesting

1. **Check system settings**:
   - Permissions may have been previously denied
   - Go to system settings and manually grant

2. **Reinstall app**:
   - Completely uninstall
   - Reinstall to reset permission state

## Support

For issues or questions:
1. Check device logs for error messages
2. Verify all prerequisites are met
3. Try disabling and re-enabling the feature
4. Contact support with device model and OS version


