// Workout History Generator Service
// Handles rolling horizon generation of workout instances from recurring schedules

import { supabase } from './supabase';
import { Schedule, WorkoutHistory } from '../types';

export interface WorkoutHistoryGenerator {
  generateWorkoutHistoryFromSchedule: (scheduleId: string, startDate: Date, endDate: Date) => Promise<WorkoutHistory[]>;
  ensureHistoryGenerated: (targetDate: Date, userId: string) => Promise<void>;
  regenerateScheduleHistory: (scheduleId: string, fromDate: Date) => Promise<void>;
  deleteFutureWorkoutHistory: (scheduleId: string, fromDate: Date) => Promise<void>;
  testWorkoutHistoryGeneration: (userId: string) => Promise<void>;
  cleanupDuplicateWorkouts: (scheduleId: string) => Promise<void>;
  cleanupAllDuplicateWorkouts: (userId: string) => Promise<void>;
}

// Helper function to calculate workout dates based on recurring pattern
function calculateWorkoutDates(schedule: Schedule, startDate: Date, endDate: Date): Date[] {
  console.log('calculateWorkoutDates called with:', {
    scheduleId: schedule.id,
    isRecurring: schedule.isRecurring,
    recurringPattern: schedule.recurringPattern,
    scheduleStartTime: schedule.startTime,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  
  const dates: Date[] = [];
  const scheduleStartTime = new Date(schedule.startTime);
  
  // Get the base time components (hour, minute)
  const baseHour = scheduleStartTime.getHours();
  const baseMinute = scheduleStartTime.getMinutes();
  
  // Calculate duration
  const scheduleEndTime = new Date(schedule.endTime);
  const duration = scheduleEndTime.getTime() - scheduleStartTime.getTime();
  
  if (!schedule.isRecurring || !schedule.recurringPattern) {
    console.log('Schedule is not recurring or has no pattern');
    // Single workout - only include if it falls within the date range
    if (scheduleStartTime >= startDate && scheduleStartTime <= endDate) {
      dates.push(scheduleStartTime);
    }
    return dates;
  }
  
  // Generate dates based on recurring pattern
  // Start from the schedule's start time, not the generation start date
  let currentDate = new Date(scheduleStartTime.getTime());
  const endDateTime = endDate.getTime();
  
  console.log(`Starting date calculation from schedule start time: ${currentDate.toISOString()}`);
  
  switch (schedule.recurringPattern) {
    case 'daily':
      // Every day
      while (currentDate.getTime() <= endDateTime) {
        // Only include dates within the requested range
        if (currentDate.getTime() >= startDate.getTime()) {
          const workoutDate = new Date(currentDate);
          workoutDate.setHours(baseHour, baseMinute, 0, 0);
          dates.push(workoutDate);
          console.log(`Added daily workout date: ${workoutDate.toISOString()}`);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;
      
    case 'weekly':
      // Every week on the same day
      const dayOfWeek = scheduleStartTime.getDay();
      console.log(`Weekly pattern: day of week = ${dayOfWeek}, base time = ${baseHour}:${baseMinute}`);
      
      // Start from the first occurrence of the target day of week
      while (currentDate.getDay() !== dayOfWeek && currentDate.getTime() <= endDateTime) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      while (currentDate.getTime() <= endDateTime) {
        // Only include dates within the requested range
        if (currentDate.getTime() >= startDate.getTime()) {
          const workoutDate = new Date(currentDate);
          workoutDate.setHours(baseHour, baseMinute, 0, 0);
          dates.push(workoutDate);
          console.log(`Added weekly workout date: ${workoutDate.toISOString()}`);
        }
        currentDate.setDate(currentDate.getDate() + 7);
      }
      break;
      
    case 'monthly':
      // Every month on the same date
      while (currentDate.getTime() <= endDateTime) {
        // Only include dates within the requested range
        if (currentDate.getTime() >= startDate.getTime()) {
          const workoutDate = new Date(currentDate);
          workoutDate.setHours(baseHour, baseMinute, 0, 0);
          dates.push(workoutDate);
          console.log(`Added monthly workout date: ${workoutDate.toISOString()}`);
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      break;
      
    case 'custom':
      // For now, treat custom as weekly (can be enhanced later)
      while (currentDate.getTime() <= endDateTime) {
        // Only include dates within the requested range
        if (currentDate.getTime() >= startDate.getTime()) {
          const workoutDate = new Date(currentDate);
          workoutDate.setHours(baseHour, baseMinute, 0, 0);
          dates.push(workoutDate);
          console.log(`Added custom workout date: ${workoutDate.toISOString()}`);
        }
        currentDate.setDate(currentDate.getDate() + 7);
      }
      break;
  }
  
  return dates;
}

// Generate workout history entries from a schedule within a date range
async function generateWorkoutHistoryFromSchedule(
  scheduleId: string, 
  startDate: Date, 
  endDate: Date
): Promise<WorkoutHistory[]> {
  console.log(`Generating workout history for schedule ${scheduleId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // First, clean up any existing duplicates for this schedule
  await cleanupDuplicateWorkouts(scheduleId);
  
  // Get the schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .single() as { data: any; error: any };
    
  if (scheduleError || !schedule) {
    throw new Error(`Schedule not found: ${scheduleError?.message || 'Unknown error'}`);
  }
  
  // Transform database fields to the format expected by calculateWorkoutDates
  const transformedSchedule: Schedule = {
    id: schedule.id,
    userId: schedule.user_id,
    gymId: schedule.gym_id,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    isRecurring: schedule.is_recurring,
    recurringPattern: schedule.recurring_pattern,
    workoutType: schedule.workout_type,
    title: schedule.title,
    notes: schedule.notes,
    status: schedule.status,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  };
  
  console.log('Transformed schedule:', transformedSchedule);
  
  // Calculate workout dates
  const workoutDates = calculateWorkoutDates(transformedSchedule, startDate, endDate);
  
  console.log(`Calculated ${workoutDates.length} workout dates for schedule ${scheduleId}`);
  console.log('Schedule details:', {
    id: transformedSchedule.id,
    isRecurring: transformedSchedule.isRecurring,
    recurringPattern: transformedSchedule.recurringPattern,
    startTime: transformedSchedule.startTime,
    endTime: transformedSchedule.endTime
  });
  console.log('Date range:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  
  if (workoutDates.length === 0) {
    console.log('No workout dates calculated - this might indicate an issue with the date calculation logic');
    return [];
  }
  
  // Check which dates already have workout history entries for this schedule
  // We need to check for exact matches to prevent duplicates
  const { data: existingEntries, error: existingError } = await supabase
    .from('workout_history')
    .select('start_time, end_time, workout_type, title')
    .eq('schedule_id', scheduleId)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString()) as { data: any[]; error: any };
    
  if (existingError) {
    console.error('Error checking existing entries:', existingError);
  }
  
  // Create a set of existing workout times for quick lookup
  const existingWorkoutTimes = new Set(
    (existingEntries || []).map(entry => {
      const startTime = new Date(entry.start_time);
      return `${startTime.getFullYear()}-${startTime.getMonth()}-${startTime.getDate()}-${startTime.getHours()}-${startTime.getMinutes()}`;
    })
  );
  
  console.log(`Found ${existingEntries?.length || 0} existing workout entries for schedule ${scheduleId}`);
  console.log('Existing workout times:', Array.from(existingWorkoutTimes));
  
  // Create workout history entries for new dates
  const newEntries = workoutDates
    .filter(date => {
      // Create a unique key for this workout time
      const workoutKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      const isDuplicate = existingWorkoutTimes.has(workoutKey);
      
      if (isDuplicate) {
        console.log(`Skipping duplicate workout at ${date.toISOString()}`);
      }
      
      return !isDuplicate;
    })
    .map(date => {
      const endTime = new Date(date.getTime() + (new Date(transformedSchedule.endTime).getTime() - new Date(transformedSchedule.startTime).getTime()));
      
      // Map old workout types to new ones, or use default
      const validWorkoutTypes = ['limit', 'power', 'endurance', 'technique', 'volume', 'projecting', 'recovery', 'cardio'];
      let workoutType = transformedSchedule.workoutType;
      
      // If workoutType is null, undefined, or not in the valid list, set to null (allowed by constraint)
      if (!workoutType || !validWorkoutTypes.includes(workoutType)) {
        // Map old types to new equivalents if needed
        const oldTypeMap: Record<string, string> = {
          'strength': 'limit',
          'yoga': 'recovery',
          'running': 'cardio',
          'climbing': 'projecting',
          'crossfit': 'power',
          'custom': 'volume',
        };
        
        if (workoutType && oldTypeMap[workoutType]) {
          workoutType = oldTypeMap[workoutType];
        } else {
          // Set to null if it's not a valid type (constraint allows NULL)
          workoutType = null;
        }
      }
      
      const entry: any = {
        user_id: transformedSchedule.userId,
        gym_id: transformedSchedule.gymId,
        start_time: date.toISOString(),
        end_time: endTime.toISOString(),
        duration: Math.round((endTime.getTime() - date.getTime()) / 60000), // Duration in minutes
        workout_type: workoutType, // Now guaranteed to be valid or null
        title: transformedSchedule.title || transformedSchedule.workoutType || 'Workout',
        notes: transformedSchedule.notes,
        status: 'planned', // Mark as planned/scheduled workout
      };
      
      // Include schedule-related fields
      entry.schedule_id = scheduleId;
      entry.is_exception = false;
      entry.is_recurring = transformedSchedule.isRecurring; // FIX: Set is_recurring based on schedule
      
      return entry;
    });
  
  if (newEntries.length === 0) {
    console.log('No new workout history entries to create');
    return [];
  }
  
  // Insert new entries
  console.log(`Attempting to insert ${newEntries.length} workout history entries`);
  console.log('Sample entry:', JSON.stringify(newEntries[0], null, 2));
  
  try {
    const { data: insertedEntries, error: insertError } = await supabase
      .from('workout_history')
      .insert(newEntries as any)
      .select();
      
    if (insertError) {
      console.error('Insert error details:', insertError);
      throw new Error(`Failed to create workout history entries: ${insertError.message}`);
    }
    
    console.log(`Successfully created ${insertedEntries?.length || 0} new workout history entries`);
    
    // Transform to WorkoutHistory format
    return (insertedEntries || []).map((entry: any) => ({
      id: entry.id,
      userId: entry.user_id,
      gymId: entry.gym_id,
      startTime: entry.start_time,
      endTime: entry.end_time,
      duration: entry.duration,
      workoutType: entry.workout_type,
      title: entry.title,
      notes: entry.notes,
      exercises: entry.exercises || [],
      presenceId: entry.presence_id,
      scheduleId: entry.schedule_id,
      isException: entry.is_exception,
      isRecurring: entry.is_recurring ?? false, // FIX: Include isRecurring from database
      status: entry.status || 'planned',
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}

// Ensure workout history is generated up to a target date for all active schedules
async function ensureHistoryGenerated(targetDate: Date, userId: string): Promise<void> {
  console.log(`Ensuring workout history generated for user ${userId} up to ${targetDate.toISOString()}`);
  
  // Get all active recurring schedules for the user
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .eq('status', 'planned');
    
  if (schedulesError) {
    throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
  }
  
  if (!schedules || schedules.length === 0) {
    console.log('No active recurring schedules found');
    return;
  }
  
  // Generate history for each schedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const schedule of schedules) {
    try {
      // Use the schedule's start time (or today, whichever is earlier) to ensure we capture all dates
      const scheduleStartTime = new Date(schedule.start_time);
      const startDate = scheduleStartTime < today ? scheduleStartTime : today;
      startDate.setHours(0, 0, 0, 0);
      
      console.log(`Generating history for schedule ${schedule.id} from ${startDate.toISOString()} to ${targetDate.toISOString()}`);
      await generateWorkoutHistoryFromSchedule(schedule.id, startDate, targetDate);
    } catch (error) {
      console.error(`Failed to generate history for schedule ${schedule.id}:`, error);
    }
  }
}

// Regenerate workout history for a schedule from a specific date
async function regenerateScheduleHistory(scheduleId: string, fromDate: Date): Promise<void> {
  console.log(`Regenerating workout history for schedule ${scheduleId} from ${fromDate.toISOString()}`);
  
  // Delete future non-exception entries for this schedule
  await deleteFutureWorkoutHistory(scheduleId, fromDate);
  
  // Generate new entries from the fromDate to 90 days in the future
  const endDate = new Date(fromDate);
  endDate.setDate(endDate.getDate() + 90);
  
  await generateWorkoutHistoryFromSchedule(scheduleId, fromDate, endDate);
}

// Delete future workout history entries for a schedule
async function deleteFutureWorkoutHistory(scheduleId: string, fromDate: Date): Promise<void> {
  console.log(`Deleting future workout history for schedule ${scheduleId} from ${fromDate.toISOString()}`);
  
  const { error } = await supabase
    .from('workout_history')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('is_exception', false)
    .gte('start_time', fromDate.toISOString()) as { error: any };
    
  if (error) {
    throw new Error(`Failed to delete future workout history: ${error.message}`);
  }
}

// Test function to manually trigger workout history generation
async function testWorkoutHistoryGeneration(userId: string): Promise<void> {
  console.log('Testing workout history generation...');
  
  try {
  // Get all recurring schedules for the user
  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .eq('status', 'planned') as { data: any[]; error: any };
      
    if (error) {
      console.error('Error fetching schedules:', error);
      return;
    }
    
    console.log(`Found ${schedules?.length || 0} recurring schedules`);
    
    if (!schedules || schedules.length === 0) {
      console.log('No recurring schedules found for testing');
      return;
    }
    
    // Test generation for the first schedule
    const testSchedule = schedules[0] as any;
    console.log('Testing with schedule:', testSchedule);
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // Just generate 1 week for testing
    
    const result = await generateWorkoutHistoryFromSchedule(
      testSchedule.id,
      startDate,
      endDate
    );
    
    console.log(`Test completed. Generated ${result.length} workout history entries`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Clean up duplicate workout history entries for all schedules
async function cleanupAllDuplicateWorkouts(userId: string): Promise<void> {
  console.log(`Cleaning up duplicate workouts for user ${userId}`);
  
  try {
    // Get all recurring schedules for the user
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('id')
      .eq('user_id', userId)
      .eq('is_recurring', true) as { data: any[]; error: any };
      
    if (error) {
      console.error('Error fetching schedules for cleanup:', error);
      return;
    }
    
    if (!schedules || schedules.length === 0) {
      console.log('No recurring schedules found for cleanup');
      return;
    }
    
    console.log(`Found ${schedules.length} recurring schedules to clean up`);
    
    // Clean up duplicates for each schedule
    for (const schedule of schedules) {
      await cleanupDuplicateWorkouts(schedule.id);
    }
    
    console.log('Finished cleaning up all duplicate workouts');
    
  } catch (error) {
    console.error('Error during bulk cleanup:', error);
  }
}

// Clean up duplicate workout history entries for a schedule
async function cleanupDuplicateWorkouts(scheduleId: string): Promise<void> {
  console.log(`Cleaning up duplicate workouts for schedule ${scheduleId}`);
  
  try {
    // Get all workout entries for this schedule
    const { data: allEntries, error } = await supabase
      .from('workout_history')
      .select('id, start_time, end_time, title, workout_type')
      .eq('schedule_id', scheduleId)
      .order('start_time') as { data: any[]; error: any };
      
    if (error) {
      console.error('Error fetching entries for cleanup:', error);
      return;
    }
    
    if (!allEntries || allEntries.length <= 1) {
      console.log('No duplicates found or only one entry exists');
      return;
    }
    
    // Group entries by unique workout time
    const workoutGroups = new Map();
    
    allEntries.forEach(entry => {
      const startTime = new Date(entry.start_time);
      const workoutKey = `${startTime.getFullYear()}-${startTime.getMonth()}-${startTime.getDate()}-${startTime.getHours()}-${startTime.getMinutes()}`;
      
      if (!workoutGroups.has(workoutKey)) {
        workoutGroups.set(workoutKey, []);
      }
      workoutGroups.get(workoutKey).push(entry);
    });
    
    // Find and remove duplicates (keep the first entry, delete the rest)
    const duplicateIds: string[] = [];
    
    workoutGroups.forEach((entries, workoutKey) => {
      if (entries.length > 1) {
        console.log(`Found ${entries.length} duplicates for workout at ${workoutKey}`);
        // Keep the first entry (oldest), delete the rest
        const duplicates = entries.slice(1);
        duplicateIds.push(...duplicates.map(entry => entry.id));
      }
    });
    
    if (duplicateIds.length > 0) {
      console.log(`Deleting ${duplicateIds.length} duplicate entries`);
      
      const { error: deleteError } = await supabase
        .from('workout_history')
        .delete()
        .in('id', duplicateIds);
        
      if (deleteError) {
        console.error('Error deleting duplicates:', deleteError);
      } else {
        console.log(`Successfully cleaned up ${duplicateIds.length} duplicate entries`);
      }
    } else {
      console.log('No duplicates found to clean up');
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

export const workoutHistoryGenerator: WorkoutHistoryGenerator = {
  generateWorkoutHistoryFromSchedule,
  ensureHistoryGenerated,
  regenerateScheduleHistory,
  deleteFutureWorkoutHistory,
  testWorkoutHistoryGeneration,
  cleanupDuplicateWorkouts,
  cleanupAllDuplicateWorkouts,
};
