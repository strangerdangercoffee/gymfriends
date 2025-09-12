import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Schedule, ScheduleStackParamList } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';

type ScheduleScreenNavigationProp = StackNavigationProp<ScheduleStackParamList, 'ScheduleMain'>;

const ScheduleScreen: React.FC = () => {
  const navigation = useNavigation<ScheduleScreenNavigationProp>();
  const { schedules, isLoading } = useApp();
  const { user } = useAuth();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week');

  const filteredSchedules = schedules.filter(schedule => {
    const now = new Date();
    const scheduleDate = new Date(schedule.startTime);
    
    switch (selectedTimeRange) {
      case 'today':
        return scheduleDate.toDateString() === now.toDateString();
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return scheduleDate >= weekStart && scheduleDate <= weekEnd;
      case 'month':
        return scheduleDate.getMonth() === now.getMonth() && 
               scheduleDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status: Schedule['status']) => {
    switch (status) {
      case 'planned':
        return '#007AFF';
      case 'active':
        return '#34C759';
      case 'completed':
        return '#8E8E93';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#007AFF';
    }
  };

  const handleAddSchedule = () => {
    navigation.navigate('AddSchedule');
  };

  const handleEditSchedule = (schedule: Schedule) => {
    // TODO: Navigate to edit schedule screen
    Alert.alert('Edit Schedule', `Edit schedule for ${schedule.workoutType || 'Workout'}`);
  };

  const handleDeleteSchedule = (schedule: Schedule) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement delete functionality
            console.log('Delete schedule:', schedule.id);
          }
        },
      ]
    );
  };

  const renderScheduleItem = ({ item }: { item: Schedule }) => (
    <Card style={styles.scheduleCard}>
      <View style={styles.scheduleHeader}>
        <View style={styles.scheduleInfo}>
          <Text style={styles.workoutType}>
            {item.workoutType || 'Workout'}
          </Text>
          <Text style={styles.gymName}>
            {/* TODO: Get gym name from gym ID */}
            Gym Name
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.scheduleDetails}>
        <View style={styles.timeInfo}>
          <Ionicons name="time-outline" size={16} color="#8E8E93" />
          <Text style={styles.timeText}>
            {formatDate(item.startTime)} • {formatTime(item.startTime)} - {formatTime(item.endTime)}
          </Text>
        </View>
        
        {item.isRecurring && (
          <View style={styles.recurringInfo}>
            <Ionicons name="repeat-outline" size={16} color="#8E8E93" />
            <Text style={styles.recurringText}>
              Repeats {item.recurringPattern}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.scheduleActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleEditSchedule(item)}
        >
          <Ionicons name="pencil-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDeleteSchedule(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No schedules yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first workout schedule to get started
      </Text>
      <Button
        title="Add Schedule"
        onPress={handleAddSchedule}
        style={styles.addButton}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Time Range Selector */}
      <View style={styles.timeRangeSelector}>
        {(['today', 'week', 'month'] as const).map((range) => (
          <TouchableOpacity
            key={range}
            style={[
              styles.timeRangeButton,
              selectedTimeRange === range && styles.timeRangeButtonActive,
            ]}
            onPress={() => setSelectedTimeRange(range)}
          >
            <Text
              style={[
                styles.timeRangeText,
                selectedTimeRange === range && styles.timeRangeTextActive,
              ]}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add Schedule Button */}
      <View style={styles.addButtonContainer}>
        <Button
          title="Add New Schedule"
          onPress={handleAddSchedule}
          style={styles.addScheduleButton}
        />
      </View>

      {/* Schedules List */}
      {filteredSchedules.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredSchedules}
          renderItem={renderScheduleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  timeRangeTextActive: {
    color: 'white',
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  addScheduleButton: {
    backgroundColor: '#007AFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scheduleCard: {
    marginBottom: 12,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  workoutType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gymName: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
    textTransform: 'capitalize',
  },
  scheduleDetails: {
    marginBottom: 12,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  scheduleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    minWidth: 200,
  },
});

export default ScheduleScreen;

