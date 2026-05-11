import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { CalendarView } from '../types';
import { colors } from '../theme/colors';

interface CalendarHeaderProps {
  currentView: CalendarView;
  onViewChange: (view: 'week' | 'month') => void;
  onDateChange: (date: Date) => void;
  onAddWorkout: () => void;
  /** Month-only: hide week toggle; + opens add trip (or pass addAccessibilityLabel). */
  variant?: 'default' | 'areaTripsMonth';
  addAccessibilityLabel?: string;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentView,
  onViewChange,
  onDateChange,
  onAddWorkout,
  variant = 'default',
  addAccessibilityLabel = 'Add workout',
}) => {
  const formatDateRange = () => {
    const { startDate, endDate, type } = currentView;
    
    if (type === 'week') {
      const start = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const end = endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    } else if (type === 'month') {
      return startDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }
    
    return '';
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const { startDate, type } = currentView;
    const newDate = new Date(startDate);
    
    if (type === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (type === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <View style={styles.container}>
      {/* Top Row: Date Navigation */}
      <View style={styles.topRow}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateDate('prev')}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.dateButton} onPress={goToToday}>
          <Text style={styles.dateText}>{formatDateRange()}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateDate('next')}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Row: View Selector and Add Button */}
      <View style={styles.bottomRow}>
        {variant === 'areaTripsMonth' ? (
          <Text style={styles.areaTripsHint}>Friends who share trips + your plans</Text>
        ) : (
          <View style={styles.viewSelector}>
            {(['week', 'month'] as const).map((view) => (
              <TouchableOpacity
                key={view}
                style={[
                  styles.viewButton,
                  currentView.type === view && styles.viewButtonActive,
                ]}
                onPress={() => onViewChange(view)}
              >
                <Text
                  style={[
                    styles.viewButtonText,
                    currentView.type === view && styles.viewButtonTextActive,
                  ]}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddWorkout}
          accessibilityLabel={addAccessibilityLabel}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  dateButton: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 2,
  },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewButtonActive: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  viewButtonTextActive: {
    color: colors.background,
  },
  addButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.secondary,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  areaTripsHint: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    paddingRight: 8,
  },
});

export default CalendarHeader;
