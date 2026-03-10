# Duplicate Workout History Fix

## Problem Identified
Multiple instances of the same workout were being created in the `workout_history` table. For example, a workout labeled "Sooty" on 10-23-2025 had multiple duplicate entries.

## Root Cause Analysis

### **Issue 1: Flawed Duplicate Detection**
The original duplicate detection logic was comparing date strings with full timestamps:
```typescript
// PROBLEMATIC CODE
const dateStrings = workoutDates.map(date => date.toISOString().split('T')[0]);
const existingDates = new Set(
  (existingEntries || []).map(entry => new Date(entry.start_time).toISOString().split('T')[0])
);
```

**Problem**: This only checked the date (YYYY-MM-DD) but ignored the time (HH:MM), so workouts at different times on the same day were considered duplicates.

### **Issue 2: Incomplete Query**
The query to check for existing entries was too broad and didn't properly filter by schedule and time range.

### **Issue 3: No Cleanup Mechanism**
There was no way to clean up existing duplicates or prevent future ones.

## Solution Implemented

### **1. Enhanced Duplicate Detection** ✅
```typescript
// NEW IMPROVED CODE
const existingWorkoutTimes = new Set(
  (existingEntries || []).map(entry => {
    const startTime = new Date(entry.start_time);
    return `${startTime.getFullYear()}-${startTime.getMonth()}-${startTime.getDate()}-${startTime.getHours()}-${startTime.getMinutes()}`;
  })
);

// Filter with precise matching
.filter(date => {
  const workoutKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
  const isDuplicate = existingWorkoutTimes.has(workoutKey);
  
  if (isDuplicate) {
    console.log(`Skipping duplicate workout at ${date.toISOString()}`);
  }
  
  return !isDuplicate;
})
```

### **2. Improved Database Query** ✅
```typescript
// More precise query
const { data: existingEntries, error: existingError } = await supabase
  .from('workout_history')
  .select('start_time, end_time, workout_type, title')
  .eq('schedule_id', scheduleId)  // Filter by specific schedule
  .gte('start_time', startDate.toISOString())  // Start of range
  .lte('start_time', endDate.toISOString());   // End of range
```

### **3. Automatic Cleanup** ✅
```typescript
// Clean up duplicates before generating new ones
await cleanupDuplicateWorkouts(scheduleId);
```

### **4. Duplicate Cleanup Functions** ✅

#### **Single Schedule Cleanup**
```typescript
async function cleanupDuplicateWorkouts(scheduleId: string): Promise<void>
```
- Groups entries by unique workout time
- Keeps the first (oldest) entry
- Deletes all duplicates

#### **Bulk Cleanup**
```typescript
async function cleanupAllDuplicateWorkouts(userId: string): Promise<void>
```
- Cleans up duplicates for all user's recurring schedules
- Useful for fixing existing data

## Implementation Details

### **Unique Workout Key Format**
```
YYYY-M-D-HH-MM
Example: "2025-10-23-15-30" for Oct 23, 2025 at 3:30 PM
```

### **Cleanup Process**
1. **Fetch all entries** for the schedule
2. **Group by unique key** (date + time)
3. **Identify duplicates** (groups with > 1 entry)
4. **Keep first entry**, delete the rest
5. **Log results** for debugging

### **Prevention Strategy**
1. **Cleanup before generation** - Remove existing duplicates
2. **Precise duplicate detection** - Check exact time matches
3. **Better logging** - Show what's being skipped/created

## Usage Instructions

### **Automatic Prevention**
The system now automatically prevents duplicates:
- Cleanup runs before each generation
- Precise duplicate detection during generation
- Clear logging of skipped duplicates

### **Manual Cleanup**
Use the debug component to clean up existing duplicates:

```typescript
// Add to your ScheduleScreen temporarily
import { WorkoutHistoryDebugger } from '../components/WorkoutHistoryDebugger';

// In render
<WorkoutHistoryDebugger />
```

**Available functions:**
- **"Clean Up Duplicates"** - Remove all duplicates for current user
- **"Test Generation"** - Test workout generation
- **"Ensure History (90 days)"** - Generate missing workout history

### **Console Monitoring**
Watch for these log messages:
```
Cleaning up duplicate workouts for schedule {id}
Found X duplicates for workout at {date-time}
Deleting X duplicate entries
Successfully cleaned up X duplicate entries
Skipping duplicate workout at {timestamp}
```

## Testing the Fix

### **Test 1: Create New Recurring Workout**
1. Create a weekly recurring workout
2. Check console for cleanup messages
3. Verify no duplicates in database
4. Check calendar shows correct number of instances

### **Test 2: Clean Existing Duplicates**
1. Use debug component "Clean Up Duplicates" button
2. Check console for cleanup results
3. Verify database has no duplicates
4. Check calendar displays correctly

### **Test 3: Regenerate Workout History**
1. Use debug component "Ensure History (90 days)" button
2. Check console for generation logs
3. Verify no new duplicates created
4. Check calendar shows all expected workouts

## Database Verification

### **Check for Duplicates**
```sql
-- Find duplicate workout entries
SELECT schedule_id, start_time, COUNT(*) as count
FROM workout_history 
WHERE schedule_id IS NOT NULL
GROUP BY schedule_id, start_time
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### **Expected Result**
After cleanup, this query should return no rows.

### **Check Workout Count**
```sql
-- Count workouts per schedule
SELECT schedule_id, COUNT(*) as workout_count
FROM workout_history 
WHERE schedule_id IS NOT NULL
GROUP BY schedule_id
ORDER BY workout_count DESC;
```

## Benefits of the Fix

- ✅ **Eliminates duplicates** - No more multiple instances of same workout
- ✅ **Preserves data integrity** - Keeps oldest entry, removes newer duplicates
- ✅ **Prevents future duplicates** - Automatic cleanup before generation
- ✅ **Better performance** - Fewer database entries to query
- ✅ **Clear debugging** - Detailed logging of all operations
- ✅ **User-friendly** - Debug component for easy cleanup

## Future Improvements

- **Database constraints** - Add unique constraint on (schedule_id, start_time)
- **Background cleanup** - Scheduled cleanup job for all users
- **Duplicate detection metrics** - Track and alert on duplicate creation
- **User notification** - Alert users when duplicates are found and cleaned

## Migration Steps

1. **Deploy the updated code** with improved duplicate detection
2. **Run cleanup** using the debug component
3. **Verify results** using the database queries above
4. **Test creating new workouts** to ensure no duplicates
5. **Remove debug component** once cleanup is complete

The fix ensures that each recurring workout generates exactly one instance per scheduled time, eliminating the duplicate issue completely.

