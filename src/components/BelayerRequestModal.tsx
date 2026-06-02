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
import { AreaFeedPost } from '../types';
import { getBelayerRequestFeedTitle } from '../utils/belayerRequestTitles';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { colors, dateCalendarTheme } from '../theme/colors';

type AllPostType = 'belayer_request' | 'rally_pads_request' | 'lost_found' | 'general';
type BelayerClimbingType = 'lead' | 'top_rope' | 'traditional';

interface BelayerRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (post: AreaFeedPost) => void;
  /** Outdoor climbing area — mutually exclusive with initialGymId */
  initialAreaId?: string;
  /** Gym feed — mutually exclusive with initialAreaId */
  initialGymId?: string;
  /** Shown as read-only context (e.g. gym or area name) */
  contextName?: string;
}

const POST_TYPE_CONFIG: {
  type: AllPostType;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { type: 'belayer_request', label: 'Belayer', icon: 'person' },
  { type: 'rally_pads_request', label: 'Rally Pads', icon: 'cube' },
  { type: 'lost_found', label: 'Lost & Found', icon: 'search' },
  { type: 'general', label: 'General', icon: 'chatbubble-ellipses' },
];

const BELAYER_CLIMBING_TYPES: { value: BelayerClimbingType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'top_rope', label: 'Top Rope' },
  { value: 'traditional', label: 'Traditional' },
];

const isPartnerRequest = (pt: AllPostType) =>
  pt === 'belayer_request' || pt === 'rally_pads_request';

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
  const [postType, setPostType] = useState<AllPostType>('belayer_request');

  // Climbing details (partner request types only)
  const [climbingType, setClimbingType] = useState<BelayerClimbingType>('lead');

  // Timing (partner request types only)
  const [urgency, setUrgency] = useState<'now' | 'scheduled'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Content
  const [userTitle, setUserTitle] = useState(''); // for lost_found / general
  const [content, setContent] = useState('');

  // Audience
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [postToArea, setPostToArea] = useState(true);

  useEffect(() => {
    if (visible && user?.id) {
      loadUserGroups();
    }
  }, [visible, user?.id]);

  // When switching to rally_pads, bouldering is the only option — auto-select it
  const handlePostTypeChange = (type: AllPostType) => {
    setPostType(type);
    if (type === 'rally_pads_request') {
      // climbingType not used for rally pads; no action needed
    } else if (type === 'belayer_request') {
      // Reset to lead if somehow switching back
      setClimbingType('lead');
    }
  };

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
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
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

    if (!isPartnerRequest(postType) && !userTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (isPartnerRequest(postType) && urgency === 'scheduled') {
      if (!scheduledDateTime || scheduledDateTime < new Date()) {
        Alert.alert('Error', 'Please select a valid future date and time');
        return;
      }
    }

    if (isPartnerRequest(postType) && selectedGroups.length === 0 && !postToArea) {
      Alert.alert('Error', 'Please select at least one audience (groups or area feed)');
      return;
    }

    setSaving(true);
    try {
      let scheduledTimeISO: string | undefined;
      if (isPartnerRequest(postType) && urgency === 'scheduled' && scheduledDateTime) {
        scheduledTimeISO = scheduledDateTime.toISOString();
      }

      const effectiveClimbingType =
        postType === 'rally_pads_request' ? 'bouldering' : climbingType;

      const generatedTitle = isPartnerRequest(postType)
        ? getBelayerRequestFeedTitle(user?.name, postType as any, effectiveClimbingType)
        : userTitle.trim();

      const requestData = {
        gymId: initialGymId,
        areaId: initialAreaId,
        postType,
        title: generatedTitle,
        content: content.trim(),
        climbingType: isPartnerRequest(postType) ? effectiveClimbingType : undefined,
        scheduledTime: scheduledTimeISO,
        urgency: isPartnerRequest(postType) ? urgency : 'now',
        audienceGroups: isPartnerRequest(postType) && selectedGroups.length > 0 ? selectedGroups : undefined,
        audienceArea: postToArea ? (initialAreaId ? 'crag' : 'gym') : undefined,
      };

      const createdPost: AreaFeedPost = await belayerRequestApi.createBelayerRequest(
        user.id,
        requestData
      );

      const successLabel =
        postType === 'lost_found'
          ? 'Lost & Found post created'
          : postType === 'general'
          ? 'Post created'
          : 'Request posted';
      Alert.alert('Success', successLabel);

      // Reset form
      setContent('');
      setUserTitle('');
      setScheduledDateTime(new Date());
      setSelectedGroups([]);
      setPostToArea(true);
      setUrgency('now');
      setPostType('belayer_request');
      setClimbingType('lead');

      onSuccess?.(createdPost);
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
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

  const parseLocalDateYYYYMMDD = (yyyyMmDd: string): Date => {
    const parts = yyyyMmDd.split('-').map((p) => parseInt(p, 10));
    const [y, m, d] = parts;
    if (parts.length !== 3 || [y, m, d].some((n) => Number.isNaN(n))) {
      return new Date();
    }
    return new Date(y, m - 1, d);
  };

  const modalTitle =
    postType === 'lost_found'
      ? 'Lost & Found'
      : postType === 'general'
      ? 'New Post'
      : 'Find Climbing Partner';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{modalTitle}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── Post Type ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.label}>Post Type</Text>
              <View style={styles.typeButtons}>
                {POST_TYPE_CONFIG.map(({ type, label, icon }) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, postType === type && styles.typeButtonActive]}
                    onPress={() => handlePostTypeChange(type)}
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color={postType === type ? colors.background : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        postType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Context label ─────────────────────────────────────── */}
            {contextName ? (
              <View style={styles.section}>
                <Text style={styles.label}>Location</Text>
                <Text style={styles.contextNameText}>{contextName}</Text>
              </View>
            ) : null}

            {/* ── Title (lost_found / general only) ─────────────────── */}
            {!isPartnerRequest(postType) && (
              <View style={styles.section}>
                <Input
                  label="Title *"
                  placeholder={
                    postType === 'lost_found'
                      ? 'e.g. Lost blue chalk bag near wall 3'
                      : 'Post title…'
                  }
                  value={userTitle}
                  onChangeText={setUserTitle}
                  style={styles.input}
                />
              </View>
            )}

            {/* ── Climbing Type (partner requests only) ─────────────── */}
            {postType === 'belayer_request' && (
              <View style={styles.section}>
                <Text style={styles.label}>Climbing Type</Text>
                <View style={styles.climbingTypeButtons}>
                  {BELAYER_CLIMBING_TYPES.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.climbingTypeButton,
                        climbingType === value && styles.climbingTypeButtonActive,
                      ]}
                      onPress={() => setClimbingType(value)}
                    >
                      <Text
                        style={[
                          styles.climbingTypeButtonText,
                          climbingType === value && styles.climbingTypeButtonTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {postType === 'rally_pads_request' && (
              <View style={styles.section}>
                <Text style={styles.label}>Climbing Type</Text>
                <View style={styles.climbingTypeButtons}>
                  <View style={[styles.climbingTypeButton, styles.climbingTypeButtonActive]}>
                    <Text style={[styles.climbingTypeButtonText, styles.climbingTypeButtonTextActive]}>
                      Bouldering
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Timing (partner requests only) ────────────────────── */}
            {isPartnerRequest(postType) && (
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
                    <Text
                      style={[
                        styles.timingButtonText,
                        urgency === 'now' && styles.timingButtonTextActive,
                      ]}
                    >
                      Now
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.timingButton,
                      urgency === 'scheduled' && styles.timingButtonActive,
                    ]}
                    onPress={() => {
                      setUrgency('scheduled');
                      setShowDatePicker(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.timingButtonText,
                        urgency === 'scheduled' && styles.timingButtonTextActive,
                      ]}
                    >
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
            )}

            {/* ── Description ───────────────────────────────────────── */}
            <View style={styles.section}>
              <Input
                label="Description *"
                placeholder={
                  postType === 'lost_found'
                    ? 'Where/when was it lost? Any distinguishing features?'
                    : postType === 'general'
                    ? 'What would you like to share?'
                    : 'Tell potential partners about your plans…'
                }
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textArea]}
              />
            </View>

            {/* ── Audience (partner requests only) ──────────────────── */}
            {isPartnerRequest(postType) && (
              <View style={styles.section}>
                <Text style={styles.label}>Post To</Text>

                {userGroups.length > 0 && (
                  <View style={styles.audienceSection}>
                    <Text style={styles.audienceLabel}>Groups</Text>
                    <ScrollView style={styles.groupList} nestedScrollEnabled>
                      {userGroups.map((group) => {
                        const groupId = group.groupId || group.id;
                        return (
                          <TouchableOpacity
                            key={groupId}
                            style={styles.groupOption}
                            onPress={() => handleToggleGroup(groupId)}
                          >
                            <Ionicons
                              name={
                                selectedGroups.includes(groupId)
                                  ? 'checkbox'
                                  : 'square-outline'
                              }
                              size={24}
                              color={
                                selectedGroups.includes(groupId)
                                  ? colors.primary
                                  : colors.textMuted
                              }
                            />
                            <View style={styles.groupInfo}>
                              <Text style={styles.groupName}>{group.name}</Text>
                              <Text style={styles.groupMembers}>
                                {group.memberCount} members
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

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
                      Post to the public feed for this{' '}
                      {initialAreaId ? 'climbing area' : 'gym'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={
                postType === 'lost_found'
                  ? 'Post to Lost & Found'
                  : postType === 'general'
                  ? 'Post'
                  : 'Post Request'
              }
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </Card>
      </View>

      {/* ── Calendar Modal ─────────────────────────────────────────── */}
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

      {/* ── Time Picker ────────────────────────────────────────────── */}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
    fontSize: 13,
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
    marginBottom: 0,
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
