import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { belayerRequestApi, groupsApi } from '../services/api';
import { CreateBelayerRequestData } from '../types';
import { getBelayerRequestFeedTitle } from '../utils/belayerRequestTitles';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { colors, dateCalendarTheme } from '../theme/colors';

interface BelayerRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Outdoor climbing area — mutually exclusive with initialGymId */
  initialAreaId?: string;
  /** Gym feed — mutually exclusive with initialAreaId */
  initialGymId?: string;
  /** Shown as read-only context (e.g. gym or area name) */
  contextName?: string;
}

const BelayerRequestModal: React.FC<BelayerRequestModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialAreaId,
  initialGymId,
  contextName,
}) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Post type
  const [postType, setPostType] = useState<'belayer_request' | 'rally_pads_request'>('belayer_request');

  // Climbing details
  const [climbingType, setClimbingType] = useState<'lead' | 'top_rope' | 'bouldering' | 'any'>('any');
  
  // Timing
  const [urgency, setUrgency] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Content
  const [content, setContent] = useState('');
  
  // Audience
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [postToArea, setPostToArea] = useState(true);

  useEffect(() => {
    if (visible && user?.id) {
      loadUserGroups();
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

    if (!initialAreaId && !initialGymId) {
      Alert.alert('Error', 'Open this from a gym or climbing area feed first.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (urgency === 'scheduled') {
      if (!scheduledDateTime || scheduledDateTime < new Date()) {
        Alert.alert('Error', 'Please select a valid future date and time');
        return;
      }
    }

    if (selectedGroups.length === 0 && !postToArea) {
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

      const generatedTitle = getBelayerRequestFeedTitle(user?.name, postType, climbingType);

      const requestData: CreateBelayerRequestData = {
        gymId: initialGymId,
        areaId: initialAreaId,
        postType,
        title: generatedTitle,
        content: content.trim(),
        climbingType,
        scheduledTime: scheduledTimeISO,
        urgency,
        audienceGroups: selectedGroups.length > 0 ? selectedGroups : undefined,
        audienceArea: postToArea ? (initialAreaId ? 'crag' : 'gym') : undefined,
      };

      await belayerRequestApi.createBelayerRequest(user.id, requestData);

      Alert.alert('Success', 'Belayer request posted');
      
      setContent('');
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

  /**
   * Parse YYYY-MM-DD as a local calendar date. `new Date("YYYY-MM-DD")` is UTC midnight and
   * becomes the previous day in many US timezones.
   */
  const parseLocalDateYYYYMMDD = (yyyyMmDd: string): Date => {
    const parts = yyyyMmDd.split('-').map((p) => parseInt(p, 10));
    const [y, m, d] = parts;
    if (parts.length !== 3 || [y, m, d].some((n) => Number.isNaN(n))) {
      return new Date();
    }
    return new Date(y, m - 1, d);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Find Climbing Partner</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
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
                  <Ionicons name="person" size={20} color={postType === 'belayer_request' ? colors.text : colors.textMuted} />
                  <Text style={[styles.typeButtonText, postType === 'belayer_request' && styles.typeButtonTextActive]}>
                    Belayer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, postType === 'rally_pads_request' && styles.typeButtonActive]}
                  onPress={() => setPostType('rally_pads_request')}
                >
                  <Ionicons name="cube" size={20} color={postType === 'rally_pads_request' ? colors.text : colors.textMuted} />
                  <Text style={[styles.typeButtonText, postType === 'rally_pads_request' && styles.typeButtonTextActive]}>
                    Rally Pads
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {contextName ? (
              <View style={styles.section}>
                <Text style={styles.label}>Climbing area</Text>
                <Text style={styles.contextNameText}>{contextName}</Text>
              </View>
            ) : null}

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
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
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
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
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

            <View style={styles.section}>
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
                            color={selectedGroups.includes(groupId) ? colors.primary : colors.textMuted}
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
                  color={postToArea ? colors.primary : colors.textMuted}
                />
                <View style={styles.checkboxInfo}>
                  <Text style={styles.checkboxLabel}>
                    {initialAreaId ? 'Area' : 'Gym'} bulletin board
                  </Text>
                  <Text style={styles.checkboxSubtext}>
                    Post to the public feed for this {initialAreaId ? 'climbing area' : 'gym'}
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
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={formatDateForInput(scheduledDateTime)}
              minDate={formatDateForInput(new Date())}
              onDayPress={(day) => {
                const newDate = parseLocalDateYYYYMMDD(day.dateString);
                const currentTime = scheduledDateTime;
                newDate.setHours(
                  currentTime.getHours(),
                  currentTime.getMinutes(),
                  currentTime.getSeconds(),
                  currentTime.getMilliseconds()
                );
                setScheduledDateTime(newDate);
                setShowDatePicker(false);
                // Auto-open time picker after selecting date
                setTimeout(() => setShowTimePicker(true), 300);
              }}
              markedDates={{
                [formatDateForInput(scheduledDateTime)]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={dateCalendarTheme}
            />
          </Card>
        </View>
      </Modal>

      {/* Native time picker — Android uses system dialog; iOS uses sheet + spinner */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={scheduledDateTime}
          mode="time"
          display="default"
          is24Hour={false}
          accentColor={colors.primary}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === 'set' && date) {
              setScheduledDateTime(date);
            }
          }}
        />
      )}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.timePickerModalOverlay}>
            <TouchableOpacity
              style={styles.timePickerBackdrop}
              activeOpacity={1}
              onPress={() => setShowTimePicker(false)}
            />
            <Card style={styles.timePickerModal}>
              <View style={styles.calendarHeader}>
                <Text style={styles.calendarTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={scheduledDateTime}
                mode="time"
                display="spinner"
                themeVariant="dark"
                accentColor={colors.primary}
                textColor={colors.text}
                onChange={(_, date) => {
                  if (date) setScheduledDateTime(date);
                }}
              />
              <TouchableOpacity
                style={styles.timePickerDoneRow}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </TouchableOpacity>
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
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    marginBottom: 12,
  },
  contextNameText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: colors.background,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  climbingTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  climbingTypeButtonText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  climbingTypeButtonTextActive: {
    color: colors.background,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  timingButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timingButtonText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timingButtonTextActive: {
    color: colors.background,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModal: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
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
    color: colors.textSecondary,
  },
  timePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  timePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  timePickerDoneRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  timePickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
  input: {
    marginBottom: 12,
    color: colors.text,
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
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  groupMembers: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
  },
  checkboxInfo: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  checkboxSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default BelayerRequestModal;
