import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { climbingProfileApi } from '../services/api';
import { RopedGradeSystem, BoulderingGradeSystem } from '../utils/climbingGrades';
import Card from './Card';
import Button from './Button';
import GradePicker from './GradePicker';

interface OnboardingClimbingProfileProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingClimbingProfile: React.FC<OnboardingClimbingProfileProps> = ({
  onComplete,
  onSkip,
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Basic profile state
  const [leadClimbing, setLeadClimbing] = useState(false);
  const [leadGradeSystem, setLeadGradeSystem] = useState<RopedGradeSystem>('yds');
  const [leadGradeMin, setLeadGradeMin] = useState('');
  const [leadGradeMax, setLeadGradeMax] = useState('');
  const [topRope, setTopRope] = useState(false);
  const [topRopeGradeSystem, setTopRopeGradeSystem] = useState<RopedGradeSystem>('yds');
  const [topRopeGradeMin, setTopRopeGradeMin] = useState('');
  const [topRopeGradeMax, setTopRopeGradeMax] = useState('');
  const [bouldering, setBouldering] = useState(false);
  const [boulderGradeSystem, setBoulderGradeSystem] = useState<BoulderingGradeSystem>('v_scale');
  const [boulderMaxFlash, setBoulderMaxFlash] = useState('');
  const [boulderMaxSend, setBoulderMaxSend] = useState('');
  const [traditionalClimbing, setTraditionalClimbing] = useState(false);
  const [traditionalGradeSystem, setTraditionalGradeSystem] = useState<RopedGradeSystem>('yds');
  const [traditionalGradeMin, setTraditionalGradeMin] = useState('');
  const [traditionalGradeMax, setTraditionalGradeMax] = useState('');
  const [openToNewPartners, setOpenToNewPartners] = useState(false);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
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
      });
      onComplete();
    } catch (error) {
      console.error('Error saving climbing profile:', error);
      // Still complete onboarding even if profile save fails
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnySelection = leadClimbing || topRope || bouldering || traditionalClimbing;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={60} color="#007AFF" />
          </View>
          <Text style={styles.title}>Climbing Profile</Text>
          <Text style={styles.description}>
            Tell us about your climbing preferences. You can add more details later!
          </Text>
        </View>

        {/* Climbing Types */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What do you climb?</Text>
          <Text style={styles.sectionSubtitle}>
            Select all that apply
          </Text>

          {/* 1. Top Rope */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="lock-closed" size={24} color="#34C759" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Top Rope</Text>
                <Text style={styles.optionDescription}>
                  Top roping the world
                </Text>
              </View>
            </View>
            <Switch
              value={topRope}
              onValueChange={setTopRope}
              trackColor={{ false: '#E5E5E7', true: '#34C759' }}
              thumbColor="white"
            />
          </View>
          {topRope && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              <View style={styles.gradeSystemRow}>
                {(['yds', 'french', 'aus'] as const).map((sys) => (
                  <TouchableOpacity
                    key={sys}
                    style={[styles.gradeSystemBtn, topRopeGradeSystem === sys && styles.gradeSystemBtnActive]}
                    onPress={() => { setTopRopeGradeSystem(sys); setTopRopeGradeMin(''); setTopRopeGradeMax(''); }}
                  >
                    <Text style={[styles.gradeSystemBtnText, topRopeGradeSystem === sys && styles.gradeSystemBtnTextActive]}>
                      {sys === 'yds' ? 'YDS' : sys === 'french' ? 'French' : 'AUS'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.gradeRow}>
                <GradePicker
                  value={topRopeGradeMin}
                  onValueChange={setTopRopeGradeMin}
                  system={topRopeGradeSystem}
                  placeholder="Max onsight"
                  style={styles.gradeInput}
                />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker
                  value={topRopeGradeMax}
                  onValueChange={setTopRopeGradeMax}
                  system={topRopeGradeSystem}
                  placeholder="Max redpoint"
                  style={styles.gradeInput}
                />
              </View>
            </View>
          )}

          {/* 2. Lead Climbing */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="arrow-up-circle" size={24} color="#007AFF" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Lead Climbing</Text>
                <Text style={styles.optionDescription}>
                  Clipping bolts
                </Text>
              </View>
            </View>
            <Switch
              value={leadClimbing}
              onValueChange={setLeadClimbing}
              trackColor={{ false: '#E5E5E7', true: '#007AFF' }}
              thumbColor="white"
            />
          </View>
          {leadClimbing && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              <View style={styles.gradeSystemRow}>
                {(['yds', 'french', 'aus'] as const).map((sys) => (
                  <TouchableOpacity
                    key={sys}
                    style={[styles.gradeSystemBtn, leadGradeSystem === sys && styles.gradeSystemBtnActive]}
                    onPress={() => { setLeadGradeSystem(sys); setLeadGradeMin(''); setLeadGradeMax(''); }}
                  >
                    <Text style={[styles.gradeSystemBtnText, leadGradeSystem === sys && styles.gradeSystemBtnTextActive]}>
                      {sys === 'yds' ? 'YDS' : sys === 'french' ? 'French' : 'AUS'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.gradeRow}>
                <GradePicker
                  value={leadGradeMin}
                  onValueChange={setLeadGradeMin}
                  system={leadGradeSystem}
                  placeholder="Max onsight"
                  style={styles.gradeInput}
                />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker
                  value={leadGradeMax}
                  onValueChange={setLeadGradeMax}
                  system={leadGradeSystem}
                  placeholder="Max redpoint"
                  style={styles.gradeInput}
                />
              </View>
            </View>
          )}

          {/* 3. Bouldering */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="cube" size={24} color="#FF9500" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Bouldering</Text>
                <Text style={styles.optionDescription}>
                  Pebble wrestling
                </Text>
              </View>
            </View>
            <Switch
              value={bouldering}
              onValueChange={setBouldering}
              trackColor={{ false: '#E5E5E7', true: '#FF9500' }}
              thumbColor="white"
            />
          </View>
          {bouldering && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grades</Text>
              <View style={styles.gradeSystemRow}>
                <TouchableOpacity
                  style={[styles.gradeSystemBtn, boulderGradeSystem === 'v_scale' && styles.gradeSystemBtnActive]}
                  onPress={() => { setBoulderGradeSystem('v_scale'); setBoulderMaxFlash(''); setBoulderMaxSend(''); }}
                >
                  <Text style={[styles.gradeSystemBtnText, boulderGradeSystem === 'v_scale' && styles.gradeSystemBtnTextActive]}>
                    V-Scale
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.gradeSystemBtn, boulderGradeSystem === 'font' && styles.gradeSystemBtnActive]}
                  onPress={() => { setBoulderGradeSystem('font'); setBoulderMaxFlash(''); setBoulderMaxSend(''); }}
                >
                  <Text style={[styles.gradeSystemBtnText, boulderGradeSystem === 'font' && styles.gradeSystemBtnTextActive]}>
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
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker
                  value={boulderMaxSend}
                  onValueChange={setBoulderMaxSend}
                  system={boulderGradeSystem}
                  placeholder="Max send"
                  style={styles.gradeInput}
                />
              </View>
            </View>
          )}

          {/* 4. Trad Climbing */}
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#FFA000" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Trad Climbing</Text>
                <Text style={styles.optionDescription}>
                  Plugging gear
                </Text>
              </View>
            </View>
            <Switch
              value={traditionalClimbing}
              onValueChange={setTraditionalClimbing}
              trackColor={{ false: '#E5E5E7', true: '#FFA000' }}
              thumbColor="white"
            />
          </View>
          {traditionalClimbing && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              <View style={styles.gradeSystemRow}>
                {(['yds', 'french', 'aus'] as const).map((sys) => (
                  <TouchableOpacity
                    key={sys}
                    style={[styles.gradeSystemBtn, traditionalGradeSystem === sys && styles.gradeSystemBtnActive]}
                    onPress={() => { setTraditionalGradeSystem(sys); setTraditionalGradeMin(''); setTraditionalGradeMax(''); }}
                  >
                    <Text style={[styles.gradeSystemBtnText, traditionalGradeSystem === sys && styles.gradeSystemBtnTextActive]}>
                      {sys === 'yds' ? 'YDS' : sys === 'french' ? 'French' : 'AUS'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.gradeRow}>
                <GradePicker
                  value={traditionalGradeMin}
                  onValueChange={setTraditionalGradeMin}
                  system={traditionalGradeSystem}
                  placeholder="Max onsight"
                  style={styles.gradeInput}
                />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker
                  value={traditionalGradeMax}
                  onValueChange={setTraditionalGradeMax}
                  system={traditionalGradeSystem}
                  placeholder="Max redpoint"
                  style={styles.gradeInput}
                />
              </View>
            </View>
          )}
        </Card>

        {/* 5. Open to new partners */}
        <Card style={styles.sectionCard}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="people" size={24} color="#AF52DE" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Open to New Partners</Text>
                <Text style={styles.optionDescription}>
                  Let others know you're looking for climbing partners
                </Text>
              </View>
            </View>
            <Switch
              value={openToNewPartners}
              onValueChange={setOpenToNewPartners}
              trackColor={{ false: '#E5E5E7', true: '#AF52DE' }}
              thumbColor="white"
            />
          </View>
        </Card>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.infoTitle}>You can add more details later</Text>
          </View>
          <Text style={styles.infoText}>
            Add grades, certifications, and more in your Profile anytime.
          </Text>
        </Card>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <Button
          title="Complete Later"
          variant="outline"
          onPress={onSkip}
          style={styles.skipButton}
        />
        <Button
          title={hasAnySelection ? "Continue" : "Skip for Now"}
          onPress={handleSave}
          loading={isSaving}
          variant={hasAnySelection ? 'primary' : 'outline'}
          style={styles.continueButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  sectionCard: {
    marginBottom: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  gradeSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  gradeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginBottom: 8,
  },
  gradeSystemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gradeSystemBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  gradeSystemBtnActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  gradeSystemBtnText: {
    fontSize: 14,
    color: '#666',
  },
  gradeSystemBtnTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeInput: {
    flex: 1,
  },
  gradeSeparator: {
    fontSize: 16,
    color: '#8E8E93',
  },
  infoCard: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#E3F2FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#007AFF',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
    gap: 12,
  },
  skipButton: {
    flex: 1,
  },
  continueButton: {
    flex: 1,
  },
});

export default OnboardingClimbingProfile;
