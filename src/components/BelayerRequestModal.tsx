import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { belayerRequestApi, groupsApi } from '../services/api';
import { CreateBelayerRequestData } from '../types';
import Card from './Card';
import Button from './Button';
import Input from './Input';

interface BelayerRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When set, post is for this climbing area (outdoor); gym/crag selector is skipped */
  initialAreaId?: string;
}

const BelayerRequestModal: React.FC<BelayerRequestModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialAreaId,
}) => {
  const { user } = useAuth();
  const { followedGyms } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Post type
  const [postType, setPostType] = useState<'belayer_request' | 'rally_pads_request'>('belayer_request');
  
  // Area selection
  const [areaType, setAreaType] = useState<'gym' | 'crag'>('gym');
  const [selectedGymId, setSelectedGymId] = useState('');
  const [cragName, setCragName] = useState('');
  
  // Climbing details
  const [climbingType, setClimbingType] = useState<'lead' | 'top_rope' | 'bouldering' | 'any'>('any');
  const [targetRoute, setTargetRoute] = useState('');
  const [targetGrade, setTargetGrade] = useState('');
  
  // Timing
  const [urgency, setUrgency] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Content
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // Audience
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [postToArea, setPostToArea] = useState(true);

  useEffect(() => {
    if (visible && user?.id) {
      loadUserGroups();
      // Set default gym if available
      if (followedGyms.length > 0 && !selectedGymId) {
        setSelectedGymId(followedGyms[0].id);
      }
    }
  }, [visible, user?.id]);

  const loadUserGroups = async () => {
    if (!user?.id) return;
    
    setLoadingGroups(true);
    try {
      const groups = await groupsApi.getUserGroups(user.id);
      setUserGroups(groups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (!initialAreaId) {
      if (areaType === 'gym' && !selectedGymId) {
        Alert.alert('Error', 'Please select a gym');
        return;
      }
      if (areaType === 'crag' && !cragName.trim()) {
        Alert.alert('Error', 'Please enter a crag name');
        return;
      }
    }

    if (urgency === 'scheduled') {
      if (!scheduledDateTime || scheduledDateTime < new Date()) {
        Alert.alert('Error', 'Please select a valid future date and time');
        return;
      }
    }

    if (!initialAreaId && selectedGroups.length === 0 && !postToArea) {
      Alert.alert('Error', 'Please select at least one audience (groups or area feed)');
      return;
    }

    setSaving(true);
    try {
      // Format scheduled time if provided
      let scheduledTimeISO: string | undefined;
      if (urgency === 'scheduled' && scheduledDateTime) {
        scheduledTimeISO = scheduledDateTime.toISOString();
      }

      const requestData: CreateBelayerRequestData = {
        gymId: !initialAreaId && areaType === 'gym' ? selectedGymId : undefined,
        areaId: initialAreaId,
        cragName: !initialAreaId && areaType === 'crag' ? cragName.trim() : undefined,
        postType,
        title: title.trim(),
        content: content.trim(),
        climbingType,
        targetRoute: targetRoute.trim() || undefined,
        targetGrade: targetGrade.trim() || undefined,
        scheduledTime: scheduledTimeISO,
        urgency,
        audienceGroups: selectedGroups.length > 0 ? selectedGroups : undefined,
        audienceArea: postToArea ? areaType : undefined,
      };

      await belayerRequestApi.createBelayerRequest(user.id, requestData);

      Alert.alert('Success', 'Belayer request posted');
      
      // Reset form
      setTitle('');
      setContent('');
      setTargetRoute('');
      setTargetGrade('');
      setScheduledDateTime(new Date());
      setSelectedGroups([]);
      setPostToArea(true);
      setUrgency('now');
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating belayer request:', error);
      Alert.alert('Error', 'Failed to create belayer request');
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Find Climbing Partner</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Post Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Request Type</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, postType === 'belayer_request' && styles.typeButtonActive]}
                  onPress={() => setPostType('belayer_request')}
                >
                  <Ionicons name="person" size={20} color={postType === 'belayer_request' ? '#FFF' : '#666'} />
                  <Text style={[styles.typeButtonText, postType === 'belayer_request' && styles.typeButtonTextActive]}>
                    Belayer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, postType === 'rally_pads_request' && styles.typeButtonActive]}
                  onPress={() => setPostType('rally_pads_request')}
                >
                  <Ionicons name="cube" size={20} color={postType === 'rally_pads_request' ? '#FFF' : '#666'} />
                  <Text style={[styles.typeButtonText, postType === 'rally_pads_request' && styles.typeButtonTextActive]}>
                    Rally Pads
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Area Selection (hidden when posting from area detail, initialAreaId set) */}
            {!initialAreaId && (
            <View style={styles.section}>
              <Text style={styles.label}>Climbing Area</Text>
              <View style={styles.areaTypeButtons}>
                <TouchableOpacity
                  style={[styles.areaTypeButton, areaType === 'gym' && styles.areaTypeButtonActive]}
                  onPress={() => {
                    setAreaType('gym');
                    setCragName('');
                  }}
                >
                  <Text style={[styles.areaTypeButtonText, areaType === 'gym' && styles.areaTypeButtonTextActive]}>
                    Gym
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.areaTypeButton, areaType === 'crag' && styles.areaTypeButtonActive]}
                  onPress={() => {
                    setAreaType('crag');
                    setSelectedGymId('');
                  }}
                >
                  <Text style={[styles.areaTypeButtonText, areaType === 'crag' && styles.areaTypeButtonTextActive]}>
                    Crag
                  </Text>
                </TouchableOpacity>
              </View>

              {areaType === 'gym' ? (
                <ScrollView style={styles.gymList} nestedScrollEnabled>
                  {followedGyms.map((gym) => (
                    <TouchableOpacity
                      key={gym.id}
                      style={[
                        styles.gymOption,
                        selectedGymId === gym.id && styles.gymOptionActive,
                      ]}
                      onPress={() => setSelectedGymId(gym.id)}
                    >
                      <Ionicons
                        name={selectedGymId === gym.id ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selectedGymId === gym.id ? '#007AFF' : '#8E8E93'}
                      />
                      <Text
                        style={[
                          styles.gymOptionText,
                          selectedGymId === gym.id && styles.gymOptionTextActive,
                        ]}
                      >
                        {gym.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Input
                  placeholder="Enter crag name"
                  value={cragName}
                  onChangeText={setCragName}
                  style={styles.input}
                />
              )}
            </View>
            )}

            {/* Climbing Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Climbing Type</Text>
              <View style={styles.climbingTypeButtons}>
                {(['lead', 'top_rope', 'bouldering', 'any'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.climbingTypeButton, climbingType === type && styles.climbingTypeButtonActive]}
                    onPress={() => setClimbingType(type)}
                  >
                    <Text style={[styles.climbingTypeButtonText, climbingType === type && styles.climbingTypeButtonTextActive]}>
                      {type === 'top_rope' ? 'Top Rope' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Target Route/Grade (Optional) */}
            <View style={styles.section}>
              <Input
                label="Target Route/Boulder (Optional)"
                placeholder="e.g., The Nose, Midnight Lightning"
                value={targetRoute}
                onChangeText={setTargetRoute}
                style={styles.input}
              />
              <Input
                label="Target Grade (Optional)"
                placeholder="e.g., 5.12a, V6"
                value={targetGrade}
                onChangeText={setTargetGrade}
                style={styles.input}
              />
            </View>

            {/* Timing */}
            <View style={styles.section}>
              <Text style={styles.label}>When?</Text>
              <View style={styles.timingButtons}>
                <TouchableOpacity
                  style={[styles.timingButton, urgency === 'now' && styles.timingButtonActive]}
                  onPress={() => {
                    setUrgency('now');
                    setScheduledDateTime(new Date());
                  }}
                >
                  <Text style={[styles.timingButtonText, urgency === 'now' && styles.timingButtonTextActive]}>
                    Now
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timingButton, urgency === 'scheduled' && styles.timingButtonActive]}
                  onPress={() => {
                    setUrgency('scheduled');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={[styles.timingButtonText, urgency === 'scheduled' && styles.timingButtonTextActive]}>
                    Scheduled
                  </Text>
                </TouchableOpacity>
              </View>

              {urgency === 'scheduled' && (
                <View style={styles.scheduledInputs}>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    <Text style={styles.dateTimeButtonText}>
                      {scheduledDateTime.toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#007AFF" />
                    <Text style={styles.dateTimeButtonText}>
                      {scheduledDateTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Title and Content */}
            <View style={styles.section}>
              <Input
                label="Title *"
                placeholder="e.g., Looking for belayer for lead climbing"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
              />
              <Input
                label="Description *"
                placeholder="Tell potential partners about your plans..."
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textArea]}
              />
            </View>

            {/* Audience Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Post To</Text>
              
              {/* Groups */}
              {userGroups.length > 0 && (
                <View style={styles.audienceSection}>
                  <Text style={styles.audienceLabel}>Groups</Text>
                  <ScrollView style={styles.groupList} nestedScrollEnabled>
                    {userGroups.map((group) => {
                      const groupId = group.groupId || group.id; // Support both formats
                      return (
                        <TouchableOpacity
                          key={groupId}
                          style={styles.groupOption}
                          onPress={() => handleToggleGroup(groupId)}
                        >
                          <Ionicons
                            name={selectedGroups.includes(groupId) ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={selectedGroups.includes(groupId) ? '#007AFF' : '#999'}
                          />
                          <View style={styles.groupInfo}>
                            <Text style={styles.groupName}>{group.name}</Text>
                            <Text style={styles.groupMembers}>{group.memberCount} members</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Area Feed */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setPostToArea(!postToArea)}
              >
                <Ionicons
                  name={postToArea ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={postToArea ? '#007AFF' : '#999'}
                />
                <View style={styles.checkboxInfo}>
                  <Text style={styles.checkboxLabel}>
                    {areaType === 'gym' ? 'Gym' : 'Crag'} Bulletin Board
                  </Text>
                  <Text style={styles.checkboxSubtext}>
                    Post to public feed for this {areaType}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Post Request"
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </Card>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <Card style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Calendar
              current={scheduledDateTime.toISOString().split('T')[0]}
              minDate={new Date().toISOString().split('T')[0]}
              onDayPress={(day) => {
                const newDate = new Date(day.dateString);
                const currentTime = scheduledDateTime;
                newDate.setHours(currentTime.getHours());
                newDate.setMinutes(currentTime.getMinutes());
                setScheduledDateTime(newDate);
                setShowDatePicker(false);
                // Auto-open time picker after selecting date
                setTimeout(() => setShowTimePicker(true), 300);
              }}
              markedDates={{
                [scheduledDateTime.toISOString().split('T')[0]]: {
                  selected: true,
                  selectedColor: '#007AFF',
                },
              }}
              theme={{
                todayTextColor: '#007AFF',
                selectedDayBackgroundColor: '#007AFF',
                selectedDayTextColor: '#FFFFFF',
                arrowColor: '#007AFF',
                monthTextColor: '#000',
                textDayFontWeight: '500',
                textMonthFontWeight: '600',
                textDayHeaderFontWeight: '600',
              }}
            />
          </Card>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.timePickerModalOverlay}>
            <Card style={styles.timePickerModal}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerContainer}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newDate = new Date(scheduledDateTime);
                    newDate.setHours(9, 0, 0, 0);
                    setScheduledDateTime(newDate);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.timeButtonText}>9:00 AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newDate = new Date(scheduledDateTime);
                    newDate.setHours(12, 0, 0, 0);
                    setScheduledDateTime(newDate);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.timeButtonText}>12:00 PM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newDate = new Date(scheduledDateTime);
                    newDate.setHours(15, 0, 0, 0);
                    setScheduledDateTime(newDate);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.timeButtonText}>3:00 PM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newDate = new Date(scheduledDateTime);
                    newDate.setHours(18, 0, 0, 0);
                    setScheduledDateTime(newDate);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={styles.timeButtonText}>6:00 PM</Text>
                </TouchableOpacity>
                <View style={styles.customTimeContainer}>
                  <Text style={styles.customTimeLabel}>Custom Time</Text>
                  <View style={styles.customTimeInputs}>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="HH"
                      value={String(scheduledDateTime.getHours()).padStart(2, '0')}
                      onChangeText={(text) => {
                        const hours = parseInt(text) || 0;
                        if (hours >= 0 && hours <= 23) {
                          const newDate = new Date(scheduledDateTime);
                          newDate.setHours(hours);
                          setScheduledDateTime(newDate);
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={styles.timeSeparator}>:</Text>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="MM"
                      value={String(scheduledDateTime.getMinutes()).padStart(2, '0')}
                      onChangeText={(text) => {
                        const minutes = parseInt(text) || 0;
                        if (minutes >= 0 && minutes <= 59) {
                          const newDate = new Date(scheduledDateTime);
                          newDate.setMinutes(minutes);
                          setScheduledDateTime(newDate);
                        }
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>
            </Card>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  areaTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  areaTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  areaTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  areaTypeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  areaTypeButtonTextActive: {
    color: '#FFF',
  },
  gymList: {
    maxHeight: 150,
  },
  gymOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  gymOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  gymOptionText: {
    fontSize: 14,
    color: '#333',
  },
  gymOptionTextActive: {
    fontWeight: '600',
    color: '#007AFF',
  },
  climbingTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  climbingTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  climbingTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  climbingTypeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  climbingTypeButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  timingButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timingButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  timingButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  timingButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timingButtonTextActive: {
    color: '#FFF',
  },
  scheduledInputs: {
    gap: 12,
    marginTop: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModal: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  timePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
  },
  timePickerContainer: {
    gap: 12,
  },
  timeButton: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  customTimeContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  customTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  customTimeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeInput: {
    width: 50,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  audienceSection: {
    marginBottom: 16,
  },
  audienceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  groupList: {
    maxHeight: 150,
  },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  groupMembers: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  checkboxInfo: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  checkboxSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});

export default BelayerRequestModal;
