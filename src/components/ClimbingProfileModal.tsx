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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { climbingProfileApi } from '../services/api';
import { ClimbingProfile, BelayCertification } from '../types';
import { RopedGradeSystem, BoulderingGradeSystem } from '../utils/climbingGrades';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import GradePicker from './GradePicker';

interface ClimbingProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const ClimbingProfileModal: React.FC<ClimbingProfileModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const { followedGyms } = useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [certifications, setCertifications] = useState<BelayCertification[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);

  // Profile state
  const [leadClimbing, setLeadClimbing] = useState<boolean>(false);
  const [leadGradeSystem, setLeadGradeSystem] = useState<RopedGradeSystem>('yds');
  const [leadGradeMin, setLeadGradeMin] = useState('');
  const [leadGradeMax, setLeadGradeMax] = useState('');
  const [topRope, setTopRope] = useState<boolean>(false);
  const [topRopeGradeSystem, setTopRopeGradeSystem] = useState<RopedGradeSystem>('yds');
  const [topRopeGradeMin, setTopRopeGradeMin] = useState('');
  const [topRopeGradeMax, setTopRopeGradeMax] = useState('');
  const [bouldering, setBouldering] = useState<boolean>(false);
  const [boulderGradeSystem, setBoulderGradeSystem] = useState<BoulderingGradeSystem>('v_scale');
  const [boulderMaxFlash, setBoulderMaxFlash] = useState('');
  const [boulderMaxSend, setBoulderMaxSend] = useState('');
  const [traditionalClimbing, setTraditionalClimbing] = useState<boolean>(false);
  const [traditionalGradeSystem, setTraditionalGradeSystem] = useState<RopedGradeSystem>('yds');
  const [traditionalGradeMin, setTraditionalGradeMin] = useState('');
  const [traditionalGradeMax, setTraditionalGradeMax] = useState('');
  const [openToNewPartners, setOpenToNewPartners] = useState(false);
  const [preferredGradeRangeMin, setPreferredGradeRangeMin] = useState('');
  const [preferredGradeRangeMax, setPreferredGradeRangeMax] = useState('');

  // Certification state
  const [showAddCert, setShowAddCert] = useState(false);
  const [selectedGymForCert, setSelectedGymForCert] = useState('');
  const [certType, setCertType] = useState<'top_rope' | 'lead' | 'both'>('top_rope');

  useEffect(() => {
    if (visible && user?.id) {
      loadProfile();
      loadCertifications();
    }
  }, [visible, user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const profile = await climbingProfileApi.getClimbingProfile(user.id);
      if (profile) {
        setLeadClimbing(profile.leadClimbing ?? false);
        setLeadGradeSystem(profile.leadGradeSystem || 'yds');
        setLeadGradeMin(profile.leadGradeMin || '');
        setLeadGradeMax(profile.leadGradeMax || '');
        setTopRope(profile.topRope ?? false);
        setTopRopeGradeSystem(profile.topRopeGradeSystem || 'yds');
        setTopRopeGradeMin(profile.topRopeGradeMin || '');
        setTopRopeGradeMax(profile.topRopeGradeMax || '');
        setBouldering(profile.bouldering ?? false);
        setBoulderGradeSystem(profile.boulderGradeSystem || 'v_scale');
        setBoulderMaxFlash(profile.boulderMaxFlash || '');
        setBoulderMaxSend(profile.boulderMaxSend || '');
        setTraditionalClimbing(profile.traditionalClimbing ?? false);
        setTraditionalGradeSystem(profile.traditionalGradeSystem || 'yds');
        setTraditionalGradeMin(profile.traditionalGradeMin || '');
        setTraditionalGradeMax(profile.traditionalGradeMax || '');
        setOpenToNewPartners(profile.openToNewPartners);
        setPreferredGradeRangeMin(profile.preferredGradeRangeMin || '');
        setPreferredGradeRangeMax(profile.preferredGradeRangeMax || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load climbing profile');
    } finally {
      setLoading(false);
    }
  };

  const loadCertifications = async () => {
    if (!user?.id) return;
    
    setLoadingCerts(true);
    try {
      const certs = await climbingProfileApi.getBelayCertifications(user.id);
      setCertifications(certs);
    } catch (error) {
      console.error('Error loading certifications:', error);
    } finally {
      setLoadingCerts(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      await climbingProfileApi.createOrUpdateClimbingProfile(user.id, {
        leadClimbing,
        leadGradeSystem: leadClimbing ? leadGradeSystem : undefined,
        leadGradeMin: leadGradeMin.trim() || undefined,
        leadGradeMax: leadGradeMax.trim() || undefined,
        topRope,
        topRopeGradeSystem: topRope ? topRopeGradeSystem : undefined,
        topRopeGradeMin: topRopeGradeMin.trim() || undefined,
        topRopeGradeMax: topRopeGradeMax.trim() || undefined,
        bouldering,
        boulderGradeSystem: bouldering ? boulderGradeSystem : undefined,
        boulderMaxFlash: boulderMaxFlash.trim() || undefined,
        boulderMaxSend: boulderMaxSend.trim() || undefined,
        traditionalClimbing,
        traditionalGradeSystem: traditionalClimbing ? traditionalGradeSystem : undefined,
        traditionalGradeMin: traditionalGradeMin.trim() || undefined,
        traditionalGradeMax: traditionalGradeMax.trim() || undefined,
        openToNewPartners,
        preferredGradeRangeMin: preferredGradeRangeMin.trim() || undefined,
        preferredGradeRangeMax: preferredGradeRangeMax.trim() || undefined,
      });

      Alert.alert('Success', 'Climbing profile saved');
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save climbing profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCertification = async () => {
    if (!user?.id || !selectedGymForCert) {
      Alert.alert('Error', 'Please select a gym');
      return;
    }

    try {
      await climbingProfileApi.addBelayCertification(user.id, selectedGymForCert, certType);
      await loadCertifications();
      setShowAddCert(false);
      setSelectedGymForCert('');
      setCertType('top_rope');
      Alert.alert('Success', 'Certification added');
    } catch (error) {
      console.error('Error adding certification:', error);
      Alert.alert('Error', 'Failed to add certification');
    }
  };

  const handleRemoveCertification = async (certId: string) => {
    Alert.alert(
      'Remove Certification',
      'Are you sure you want to remove this certification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await climbingProfileApi.removeBelayCertification(certId);
              await loadCertifications();
            } catch (error) {
              console.error('Error removing certification:', error);
              Alert.alert('Error', 'Failed to remove certification');
            }
          },
        },
      ]
    );
  };

  const renderPreferenceSelector = (
    label: string,
    value: boolean,
    onChange: (val: boolean) => void
  ) => {
    return (
      <View style={styles.preferenceRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.preferenceButtons}>
          <TouchableOpacity
            style={[styles.preferenceButton, value && styles.preferenceButtonActive]}
            onPress={() => onChange(true)}
          >
            <Text style={[styles.preferenceButtonText, value && styles.preferenceButtonTextActive]}>
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceButton, !value && styles.preferenceButtonActive]}
            onPress={() => onChange(false)}
          >
            <Text style={[styles.preferenceButtonText, !value && styles.preferenceButtonTextActive]}>
              No
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.centered}>
          <Text>Loading...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Climbing Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

            {/* Top Rope */}
            <View style={styles.section}>
              {renderPreferenceSelector('Top Rope', topRope, setTopRope)}
              {topRope && (
                <>
                  <Text style={styles.label}>Grade System</Text>
                  <View style={styles.preferenceButtons}>
                    <TouchableOpacity
                      style={[styles.preferenceButton, topRopeGradeSystem === 'yds' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTopRopeGradeSystem('yds');
                        setTopRopeGradeMin('');
                        setTopRopeGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, topRopeGradeSystem === 'yds' && styles.preferenceButtonTextActive]}>
                        YDS
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, topRopeGradeSystem === 'french' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTopRopeGradeSystem('french');
                        setTopRopeGradeMin('');
                        setTopRopeGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, topRopeGradeSystem === 'french' && styles.preferenceButtonTextActive]}>
                        French
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, topRopeGradeSystem === 'aus' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTopRopeGradeSystem('aus');
                        setTopRopeGradeMin('');
                        setTopRopeGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, topRopeGradeSystem === 'aus' && styles.preferenceButtonTextActive]}>
                        AUS
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gradeRow}>
                    <GradePicker
                      value={topRopeGradeMin}
                      onValueChange={setTopRopeGradeMin}
                      system={topRopeGradeSystem}
                      placeholder="Max onsight"
                      style={styles.gradeInput}
                    />
                    <Text style={styles.gradeSeparator}>-</Text>
                    <GradePicker
                      value={topRopeGradeMax}
                      onValueChange={setTopRopeGradeMax}
                      system={topRopeGradeSystem}
                      placeholder="Max redpoint"
                      style={styles.gradeInput}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Lead Climbing */}
            <View style={styles.section}>
              {renderPreferenceSelector('Lead Climbing', leadClimbing, setLeadClimbing)}
              {leadClimbing && (
                <>
                  <Text style={styles.label}>Grade System</Text>
                  <View style={styles.preferenceButtons}>
                    <TouchableOpacity
                      style={[styles.preferenceButton, leadGradeSystem === 'yds' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setLeadGradeSystem('yds');
                        setLeadGradeMin('');
                        setLeadGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, leadGradeSystem === 'yds' && styles.preferenceButtonTextActive]}>
                        YDS
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, leadGradeSystem === 'french' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setLeadGradeSystem('french');
                        setLeadGradeMin('');
                        setLeadGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, leadGradeSystem === 'french' && styles.preferenceButtonTextActive]}>
                        French
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, leadGradeSystem === 'aus' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setLeadGradeSystem('aus');
                        setLeadGradeMin('');
                        setLeadGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, leadGradeSystem === 'aus' && styles.preferenceButtonTextActive]}>
                        AUS
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gradeRow}>
                    <GradePicker
                      value={leadGradeMin}
                      onValueChange={setLeadGradeMin}
                      system={leadGradeSystem}
                      placeholder="Max onsight"
                      style={styles.gradeInput}
                    />
                    <Text style={styles.gradeSeparator}>-</Text>
                    <GradePicker
                      value={leadGradeMax}
                      onValueChange={setLeadGradeMax}
                      system={leadGradeSystem}
                      placeholder="Max redpoint"
                      style={styles.gradeInput}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Bouldering */}
            <View style={styles.section}>
              {renderPreferenceSelector('Bouldering', bouldering, setBouldering)}
              {bouldering && (
                <>
                  <Text style={styles.label}>Grade System</Text>
                  <View style={styles.preferenceButtons}>
                    <TouchableOpacity
                      style={[styles.preferenceButton, boulderGradeSystem === 'v_scale' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setBoulderGradeSystem('v_scale');
                        setBoulderMaxFlash('');
                        setBoulderMaxSend('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, boulderGradeSystem === 'v_scale' && styles.preferenceButtonTextActive]}>
                        V-Scale
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, boulderGradeSystem === 'font' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setBoulderGradeSystem('font');
                        setBoulderMaxFlash('');
                        setBoulderMaxSend('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, boulderGradeSystem === 'font' && styles.preferenceButtonTextActive]}>
                        Font
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gradeRow}>
                    <GradePicker
                      value={boulderMaxFlash}
                      onValueChange={setBoulderMaxFlash}
                      system={boulderGradeSystem}
                      placeholder="Max flash"
                      style={styles.gradeInput}
                    />
                  <Text style={styles.gradeSeparator}>-</Text>
                    <GradePicker
                      value={boulderMaxSend}
                      onValueChange={setBoulderMaxSend}
                      system={boulderGradeSystem}
                      placeholder="Max send"
                      style={styles.gradeInput}
                    />
                  </View>
                </>
              )}
            </View>

              {/* Traditional Climbing */}
              <View style={styles.section}>
              {renderPreferenceSelector('Trad Climbing', traditionalClimbing, setTraditionalClimbing)}
              {traditionalClimbing && (
                <>
                  <Text style={styles.label}>Grade System</Text>
                  <View style={styles.preferenceButtons}>
                    <TouchableOpacity
                      style={[styles.preferenceButton, traditionalGradeSystem === 'yds' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTraditionalGradeSystem('yds');
                        setTraditionalGradeMin('');
                        setTraditionalGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, traditionalGradeSystem === 'yds' && styles.preferenceButtonTextActive]}>
                        YDS
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, traditionalGradeSystem === 'french' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTraditionalGradeSystem('french');
                        setTraditionalGradeMin('');
                        setLeadGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, traditionalGradeSystem === 'french' && styles.preferenceButtonTextActive]}>
                        French
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, traditionalGradeSystem === 'aus' && styles.preferenceButtonActive]}
                      onPress={() => {
                        setTraditionalGradeSystem('aus');
                        setTraditionalGradeMin('');
                        setTraditionalGradeMax('');
                      }}
                    >
                      <Text style={[styles.preferenceButtonText, traditionalGradeSystem === 'aus' && styles.preferenceButtonTextActive]}>
                        AUS
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gradeRow}>
                    <GradePicker
                      value={traditionalGradeMin}
                      onValueChange={setTraditionalGradeMin}
                      system={traditionalGradeSystem}
                      placeholder="Max onsight"
                      style={styles.gradeInput}
                    />
                    <Text style={styles.gradeSeparator}>-</Text>
                    <GradePicker
                      value={traditionalGradeMax}
                      onValueChange={setTraditionalGradeMax}
                      system={traditionalGradeSystem}
                      placeholder="Max redpoint"
                      style={styles.gradeInput}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Partner Preferences */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setOpenToNewPartners(!openToNewPartners)}
              >
                <Ionicons
                  name={openToNewPartners ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={openToNewPartners ? '#007AFF' : '#999'}
                />
                <Text style={styles.checkboxLabel}>Open to climbing with new partners</Text>
              </TouchableOpacity>

              {openToNewPartners && (
                <View style={styles.gradeRow}>
                  <Input
                    placeholder="Min partner grade"
                    value={preferredGradeRangeMin}
                    onChangeText={setPreferredGradeRangeMin}
                    style={styles.gradeInput}
                  />
                  <Text style={styles.gradeSeparator}>-</Text>
                  <Input
                    placeholder="Max partner grade"
                    value={preferredGradeRangeMax}
                    onChangeText={setPreferredGradeRangeMax}
                    style={styles.gradeInput}
                  />
                </View>
              )}
            </View>

            {/* Belay Certifications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Belay Certifications</Text>
              {loadingCerts ? (
                <Text>Loading...</Text>
              ) : certifications.length === 0 ? (
                <Text style={styles.emptyText}>No certifications added</Text>
              ) : (
                certifications.map((cert) => (
                  <View key={cert.certificationId} style={styles.certRow}>
                    <View style={styles.certInfo}>
                      <Text style={styles.certGym}>{cert.gymName || 'Unknown Gym'}</Text>
                      <Text style={styles.certType}>
                        {cert.certificationType === 'both' ? 'Top Rope & Lead' :
                         cert.certificationType === 'lead' ? 'Lead' : 'Top Rope'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveCertification(cert.certificationId)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {!showAddCert ? (
                <Button
                  title="Add Certification"
                  onPress={() => setShowAddCert(true)}
                  style={styles.addButton}
                />
              ) : (
                <View style={styles.addCertForm}>
                  <Text style={styles.label}>Gym</Text>
                  <ScrollView style={styles.gymPicker}>
                    {followedGyms.map((gym) => (
                      <TouchableOpacity
                        key={gym.id}
                        style={[
                          styles.gymOption,
                          selectedGymForCert === gym.id && styles.gymOptionSelected,
                        ]}
                        onPress={() => setSelectedGymForCert(gym.id)}
                      >
                        <Text>{gym.name}</Text>
                        {selectedGymForCert === gym.id && (
                          <Ionicons name="checkmark" size={20} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Certification Type</Text>
                  <View style={styles.preferenceButtons}>
                    <TouchableOpacity
                      style={[styles.preferenceButton, certType === 'top_rope' && styles.preferenceButtonActive]}
                      onPress={() => setCertType('top_rope')}
                    >
                      <Text style={[styles.preferenceButtonText, certType === 'top_rope' && styles.preferenceButtonTextActive]}>
                        Top Rope
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, certType === 'lead' && styles.preferenceButtonActive]}
                      onPress={() => setCertType('lead')}
                    >
                      <Text style={[styles.preferenceButtonText, certType === 'lead' && styles.preferenceButtonTextActive]}>
                        Lead
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.preferenceButton, certType === 'both' && styles.preferenceButtonActive]}
                      onPress={() => setCertType('both')}
                    >
                      <Text style={[styles.preferenceButtonText, certType === 'both' && styles.preferenceButtonTextActive]}>
                        Both
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addCertButtons}>
                    <Button
                      title="Cancel"
                      onPress={() => {
                        setShowAddCert(false);
                        setSelectedGymForCert('');
                        setCertType('top_rope');
                      }}
                      style={styles.cancelButton}
                    />
                    <Button
                      title="Add"
                      onPress={handleAddCertification}
                      style={styles.addButton}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Save Profile"
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </Card>
      </View>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  preferenceRow: {
    marginBottom: 12,
  },
  preferenceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  preferenceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  preferenceButtonText: {
    fontSize: 14,
    color: '#666',
  },
  preferenceButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  gradeInput: {
    flex: 1,
  },
  gradeSeparator: {
    fontSize: 16,
    color: '#666',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  certInfo: {
    flex: 1,
  },
  certGym: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  certType: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    marginTop: 8,
  },
  addCertForm: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  gymPicker: {
    maxHeight: 150,
    marginBottom: 12,
  },
  gymOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  gymOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  addCertButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E5E5E5',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default ClimbingProfileModal;
