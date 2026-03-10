import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RopedGradeSystem,
  BoulderingGradeSystem,
  GRADE_SYSTEMS,
  YDS_GRADES,
  FRENCH_GRADES,
  AUS_GRADES,
  V_SCALE_GRADES,
  FONT_GRADES,
} from '../utils/climbingGrades';

interface GradePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  system?: RopedGradeSystem | BoulderingGradeSystem;
  placeholder?: string;
  style?: any;
}

const GradePicker: React.FC<GradePickerProps> = ({
  value,
  onValueChange,
  system,
  placeholder = 'Select grade',
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const getGrades = (): string[] => {
    if (!system) return [];
    
    if (system === 'yds') return YDS_GRADES;
    if (system === 'french') return FRENCH_GRADES;
    if (system === 'aus') return AUS_GRADES;
    if (system === 'v_scale') return V_SCALE_GRADES;
    if (system === 'font') return FONT_GRADES;
    
    return [];
  };

  const grades = getGrades();

  const handleSelect = (grade: string) => {
    onValueChange(grade);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.pickerButton, style]}
        onPress={() => setModalVisible(true)}
        disabled={!system}
      >
        <Text style={[styles.pickerText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Grade</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={grades}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.gradeOption,
                    value === item && styles.gradeOptionSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      styles.gradeOptionText,
                      value === item && styles.gradeOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {value === item && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.gradeList}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  pickerText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  gradeList: {
    padding: 16,
  },
  gradeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  gradeOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  gradeOptionText: {
    fontSize: 16,
    color: '#333',
  },
  gradeOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default GradePicker;
