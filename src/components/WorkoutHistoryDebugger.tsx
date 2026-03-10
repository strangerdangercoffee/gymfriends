// Temporary debugging component for recurring workout generation
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { workoutHistoryGenerator } from '../services/workoutHistoryGenerator';
import { useAuth } from '../context/AuthContext';

export const WorkoutHistoryDebugger: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const testGeneration = async () => {
    if (!user) {
      Alert.alert('Error', 'No user logged in');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting manual workout history generation test...');
      await workoutHistoryGenerator.testWorkoutHistoryGeneration(user.id);
      Alert.alert('Success', 'Check console logs for results');
    } catch (error) {
      console.error('Test failed:', error);
      Alert.alert('Error', `Test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testEnsureHistory = async () => {
    if (!user) {
      Alert.alert('Error', 'No user logged in');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Testing ensureHistoryGenerated...');
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 90);
      
      await workoutHistoryGenerator.ensureHistoryGenerated(targetDate, user.id);
      Alert.alert('Success', 'History generation completed - check console logs');
    } catch (error) {
      console.error('Ensure history failed:', error);
      Alert.alert('Error', `Ensure history failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupDuplicates = async () => {
    if (!user) {
      Alert.alert('Error', 'No user logged in');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Cleaning up duplicate workouts...');
      await workoutHistoryGenerator.cleanupAllDuplicateWorkouts(user.id);
      Alert.alert('Success', 'Duplicate cleanup completed - check console logs');
    } catch (error) {
      console.error('Cleanup failed:', error);
      Alert.alert('Error', `Cleanup failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout History Debugger</Text>
      <Text style={styles.subtitle}>Use these buttons to test recurring workout generation</Text>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testGeneration}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Testing...' : 'Test Generation'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testEnsureHistory}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Testing...' : 'Ensure History (90 days)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={cleanupDuplicates}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Cleaning...' : 'Clean Up Duplicates'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Check the console logs for detailed debugging information.
        Remove this component after debugging is complete.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
