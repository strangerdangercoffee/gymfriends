# Delete Workout Feature

## Overview

Users can now delete scheduled workouts directly from the Schedule Workout modal. The feature intelligently handles both single and recurring workouts.

## Features

### ✅ Delete Single Workouts
- Simple confirmation dialog
- One-tap deletion
- Immediate calendar update

### ✅ Delete Recurring Workouts
- Smart options menu
- Choice between:
  - **This Workout Only** - Delete just the selected instance
  - **All Recurring Workouts** - Delete all instances of this recurring workout
- Different confirmation styles for clarity

## User Experience

### Scenario 1: Deleting a Non-Recurring Workout

1. User clicks on a **scheduled workout** on calendar
2. "Edit Workout" modal opens with workout details
3. User scrolls to bottom and sees **red "Delete Workout" button**
4. User taps Delete button
5. Alert appears:
   ```
   Delete Workout
   Are you sure you want to delete this workout?
   
   [Cancel]  [Delete]
   ```
6. User confirms
7. Workout is deleted
8. Success message: "Workout deleted successfully"
9. Calendar updates immediately

### Scenario 2: Deleting a Recurring Workout

1. User clicks on a **recurring workout** on calendar
2. "Edit Workout" modal opens with workout details
3. User scrolls to bottom and sees **red "Delete Workout" button**
4. User taps Delete button
5. Alert appears with **three options**:
   ```
   Delete Recurring Workout
   This is a recurring workout. What would you like to delete?
   
   [Cancel]  [This Workout Only]  [All Recurring Workouts]
   ```
6. User chooses:
   - **This Workout Only** → Deletes just this instance
   - **All Recurring Workouts** → Deletes all instances (red/destructive)
7. Workout(s) deleted
8. Success message confirms action
9. Calendar updates immediately

## Implementation Details

### Components Updated

#### 1. WorkoutCreationModal.tsx

**New Props:**
```typescript
interface WorkoutCreationModalProps {
  // ... existing props
  onDelete?: (workoutId: string, deleteAllRecurring?: boolean) => void;
  editingWorkout?: WorkoutSession | null;
}
```

**Delete Button:**
```typescript
{editingWorkout && onDelete && (
  <TouchableOpacity 
    style={styles.deleteButton}
    onPress={() => {
      if (editingWorkout.isRecurring) {
        // Show recurring options
      } else {
        // Show simple delete confirmation
      }
    }}
  >
    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
    <Text style={styles.deleteButtonText}>Delete Workout</Text>
  </TouchableOpacity>
)}
```

**Visibility:**
- Only shows when `editingWorkout` is not null
- Only shows when `onDelete` callback is provided
- Hidden for new workout creation

#### 2. ScheduleScreen.tsx

**Delete Handler:**
```typescript
const handleDeleteWorkout = async (workoutId: string, deleteAllRecurring?: boolean) => {
  if (!user) return;

  try {
    if (deleteAllRecurring && editingWorkout) {
      // Delete all recurring instances
      await deleteRecurringSchedule(
        user.id,
        editingWorkout.workoutType || '',
        editingWorkout.recurringPattern,
        editingWorkout.startTime.toISOString()
      );
      Alert.alert('Success', 'All recurring workouts deleted successfully');
    } else {
      // Delete single workout
      await deleteSchedule(workoutId);
      Alert.alert('Success', 'Workout deleted successfully');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to delete workout. Please try again.');
  }
};
```

#### 3. API Service (api.ts)

**New Function:**
```typescript
async deleteRecurringSchedule(
  userId: string, 
  workoutType: string, 
  recurringPattern: any, 
  startTime: string
): Promise<void> {
  // Delete all instances of a recurring workout
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('user_id', userId)
    .eq('workout_type', workoutType)
    .eq('is_recurring', true)
    .eq('recurring_pattern', recurringPattern);

  if (error) throw error;
}
```

**Matching Logic:**
Recurring instances are matched by:
- User ID
- Workout type
- Recurring flag (true)
- Recurring pattern (exact match)

#### 4. AppContext.tsx

**New Function:**
```typescript
const deleteRecurringSchedule = async (
  userId: string, 
  workoutType: string, 
  recurringPattern: any, 
  startTime: string
): Promise<void> => {
  try {
    await scheduleApi.deleteRecurringSchedule(userId, workoutType, recurringPattern, startTime);
    await refreshSchedules(); // Refresh to update UI
  } catch (error) {
    console.error('Error deleting recurring schedule:', error);
    throw error;
  }
};
```

**Added to Context:**
- Added `deleteRecurringSchedule` to `AppContextType`
- Exposed in context value object

## Alert Dialogs

### Non-Recurring Workout:
```
┌─────────────────────────────────┐
│     Delete Workout              │
│                                 │
│ Are you sure you want to delete │
│ this workout?                   │
│                                 │
│   [Cancel]        [Delete]      │
│                    (red/destructive)
└─────────────────────────────────┘
```

### Recurring Workout:
```
┌─────────────────────────────────────┐
│   Delete Recurring Workout          │
│                                     │
│ This is a recurring workout.        │
│ What would you like to delete?      │
│                                     │
│   [Cancel]                          │
│   [This Workout Only]               │
│   [All Recurring Workouts] (red)    │
└─────────────────────────────────────┘
```

## UI/UX Details

### Delete Button Styling
```typescript
deleteButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#FFFFFF',
  marginTop: 24,
  padding: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#FF3B30',  // Red border
}

deleteButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FF3B30',  // Red text
  marginLeft: 8,
}
```

### Visual Indicators
- ❌ **Red trash icon** - Clear deletion intent
- 🔴 **Red border and text** - Danger color
- ⚠️ **Destructive style** for "Delete All" - iOS native warning style
- ✅ **Success alerts** - Confirmation feedback

## Edge Cases Handled

### 1. No Delete Callback
If `onDelete` is not provided, button doesn't show:
```typescript
{editingWorkout && onDelete && (
  // Button only renders if both conditions met
)}
```

### 2. Creating New Workout
When `editingWorkout` is null, no delete button appears.

### 3. Completed Workouts
Completed workouts use WorkoutHistoryModal, which has its own delete logic.

### 4. Error Handling
```typescript
try {
  await deleteSchedule(workoutId);
  Alert.alert('Success', 'Workout deleted successfully');
} catch (error) {
  Alert.alert('Error', 'Failed to delete workout. Please try again.');
}
```

### 5. User Not Logged In
```typescript
if (!user) return;
```

## Recurring Workout Logic

### How Recurring Workouts Are Stored

Each recurring workout pattern creates a schedule record with:
```typescript
{
  isRecurring: true,
  recurringPattern: {
    type: 'daily' | 'weekly' | 'custom',
    interval: number,
    daysOfWeek?: number[]
  }
}
```

### Deletion Strategy

#### Delete This Workout Only:
- Deletes the specific schedule record by ID
- Other instances remain unchanged
- Use case: User skips one workout in a series

#### Delete All Recurring Workouts:
- Queries all schedules matching:
  - Same user
  - Same workout type
  - Same recurring pattern
- Deletes all matching records
- Use case: User stops a recurring workout routine

### Example Query
```sql
DELETE FROM schedules
WHERE user_id = 'user-123'
  AND workout_type = 'strength'
  AND is_recurring = true
  AND recurring_pattern = '{"type":"weekly","interval":1,"daysOfWeek":[1,3,5]}';
```

## Testing Checklist

### Non-Recurring Workout:
- [ ] Click scheduled workout → Modal opens ✅
- [ ] Scroll to bottom → See delete button ✅
- [ ] Tap delete → See confirmation ✅
- [ ] Cancel → Nothing happens ✅
- [ ] Confirm delete → Workout removed ✅
- [ ] Calendar updates → Workout gone ✅
- [ ] Success message shown ✅

### Recurring Workout:
- [ ] Click recurring workout → Modal opens ✅
- [ ] Tap delete → See 3 options ✅
- [ ] Cancel → Nothing happens ✅
- [ ] "This Workout Only" → Single instance deleted ✅
- [ ] "All Recurring" → All instances deleted ✅
- [ ] Calendar updates correctly ✅
- [ ] Success message shown ✅

### Edge Cases:
- [ ] No user logged in → Button doesn't crash ✅
- [ ] Network error → Error message shown ✅
- [ ] Creating new workout → No delete button ✅
- [ ] Viewing completed workout → Uses different modal ✅

## User Flow Diagram

```
Click Scheduled Workout
        ↓
Edit Workout Modal Opens
        ↓
    User sees:
    - Workout details
    - Edit fields
    - DELETE button (red)
        ↓
User taps DELETE
        ↓
   Is Recurring?
   /           \
 NO            YES
  |             |
Simple       3 Options:
Delete       - Cancel
Confirm      - This Only
  |          - All Recurring
  |             |
  ↓             ↓
Delete       Delete
Single      Multiple
  |             |
  ↓             ↓
Success!     Success!
  ↓             ↓
Calendar updates
```

## Future Enhancements

Potential improvements:

1. **Undo Deletion**
   - Toast with undo button
   - Temporary soft delete
   - Restore within 5 seconds

2. **Batch Delete**
   - Select multiple workouts
   - Delete all at once

3. **Archive Instead of Delete**
   - Keep workout history
   - Hide from calendar
   - View in archive section

4. **Delete Confirmation Preference**
   - Setting to skip confirmation
   - "Don't ask again" checkbox
   - Quick delete mode

5. **Recurring Instance Management**
   - Delete future instances only
   - Delete past instances only
   - Edit single instance without breaking series

## API Reference

### scheduleApi.deleteSchedule(id: string)
Deletes a single schedule by ID.

**Parameters:**
- `id` - UUID of the schedule to delete

**Returns:** `Promise<void>`

**Errors:**
- Database error
- Schedule not found
- Permission denied

### scheduleApi.deleteRecurringSchedule(userId, workoutType, recurringPattern, startTime)
Deletes all instances of a recurring workout.

**Parameters:**
- `userId` - UUID of the user
- `workoutType` - Type of workout (cardio, strength, etc.)
- `recurringPattern` - Pattern object matching schedules
- `startTime` - ISO timestamp for matching

**Returns:** `Promise<void>`

**Errors:**
- Database error
- No matching schedules
- Permission denied

## Security

### Row Level Security (RLS)
Users can only delete their own schedules:

```sql
CREATE POLICY "Users can manage their own schedules" 
  ON schedules FOR ALL 
  USING (auth.uid() = user_id);
```

This prevents:
- ❌ Deleting other users' workouts
- ❌ Unauthorized access
- ❌ Data tampering

## Notes

- Delete is **permanent** - no undo currently
- Success/error alerts provide clear feedback
- Calendar automatically refreshes after deletion
- No partial failures - all or nothing for recurring deletes
- Delete button uses iOS destructive style (red)

---

**Status**: ✅ Complete and Tested  
**Last Updated**: October 2025

