// TimeSlot.tsx - Fixed version
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';

interface TimeSlotProps {
  date: Date;
  hour: number;
  minute: number;
  isSelected: boolean;
  onPress: (date: Date, hour: number, minute: number) => void;
  onDragStart: (date: Date, hour: number, minute: number) => void;
  onDragUpdate: (date: Date, hour: number, minute: number) => void;
  onDragEnd: () => void;
  onLayout?: (slotKey: string, layout: { x: number; y: number; width: number; height: number }) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({
  date,
  hour,
  minute,
  isSelected,
  onPress,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onLayout,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  const getSlotKey = () => `${date.toISOString().split('T')[0]}-${hour}-${minute}`;

  const handleLayout = (event: LayoutChangeEvent) => {
    if (onLayout) {
      const { x, y, width, height } = event.nativeEvent.layout;
      onLayout(getSlotKey(), { x, y, width, height });
    }
  };

  const handlePressIn = () => {
    setIsPressed(true);
    isDragging.current = false;
    
    // Start long press timer for drag functionality
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      onDragStart(date, hour, minute);
    }, 200); // Reduced delay for better responsiveness
  };

  const handlePressOut = () => {
    setIsPressed(false);
    
    // Clear long press timer if it hasn't fired yet
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // If we were dragging, end the drag
    if (isDragging.current) {
      isDragging.current = false;
      onDragEnd();
    }
  };

  const handlePress = () => {
    // Only trigger normal press if we're not dragging
    if (!isDragging.current) {
      onPress(date, hour, minute);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.timeSlot,
        isSelected && styles.selectedTimeSlot,
        isPressed && !isSelected && styles.pressedTimeSlot,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={handleLayout}
      activeOpacity={0.8}
      delayPressIn={0}
    />
  );
};

const styles = StyleSheet.create({
  timeSlot: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F3F4',
    minHeight: 30,
  },
  selectedTimeSlot: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  pressedTimeSlot: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
});

export default TimeSlot;