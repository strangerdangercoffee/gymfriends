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
import { colors } from '../theme/colors';

// Visible off-state track on the dark background
const SWITCH_OFF_TRACK = 'rgba(250, 237, 202, 0.2)';

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
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnySelection = leadClimbing || topRope || bouldering || traditionalClimbing;

  const renderGradeSystemToggle = (
    systems: readonly string[],
    active: string,
    onPress: (sys: any) => void,
    labels: Record<string, string>
  ) => (
    <View style={styles.gradeSystemRow}>
      {systems.map((sys) => (
        <TouchableOpacity
          key={sys}
          style={[styles.gradeSystemBtn, active === sys && styles.gradeSystemBtnActive]}
          onPress={() => onPress(sys)}
        >
          <Text style={[styles.gradeSystemBtnText, active === sys && styles.gradeSystemBtnTextActive]}>
            {labels[sys] ?? sys}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="trending-up" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Climbing Profile</Text>
          <Text style={styles.description}>
            Tell us about your climbing style. You can add more details later!
          </Text>
        </View>

        {/* Climbing Types */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What do you climb?</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply</Text>

          {/* Top Rope */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setTopRope(v => !v)} activeOpacity={0.7}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: topRope ? 'rgba(63, 245, 212, 0.2)' : 'rgba(63, 245, 212, 0.08)' }]}>
                <Ionicons name="lock-closed" size={22} color="#3FF5D4" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Top Rope</Text>
                <Text style={styles.optionDescription}>Top roping the world</Text>
              </View>
            </View>
            <Switch
              value={topRope}
              onValueChange={setTopRope}
              trackColor={{ false: SWITCH_OFF_TRACK, true: '#3FF5D4' }}
              thumbColor={topRope ? colors.background : colors.text}
            />
          </TouchableOpacity>
          {topRope && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              {renderGradeSystemToggle(
                ['yds', 'french', 'aus'],
                topRopeGradeSystem,
                (sys) => { setTopRopeGradeSystem(sys); setTopRopeGradeMin(''); setTopRopeGradeMax(''); },
                { yds: 'YDS', french: 'French', aus: 'AUS' }
              )}
              <View style={styles.gradeRow}>
                <GradePicker value={topRopeGradeMin} onValueChange={setTopRopeGradeMin} system={topRopeGradeSystem} placeholder="Max onsight" style={styles.gradeInput} />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker value={topRopeGradeMax} onValueChange={setTopRopeGradeMax} system={topRopeGradeSystem} placeholder="Max redpoint" style={styles.gradeInput} />
              </View>
            </View>
          )}

          {/* Lead Climbing */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setLeadClimbing(v => !v)} activeOpacity={0.7}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: leadClimbing ? 'rgba(63, 168, 245, 0.2)' : 'rgba(63, 168, 245, 0.08)' }]}>
                <Ionicons name="arrow-up-circle" size={22} color="#3FA8F5" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Lead Climbing</Text>
                <Text style={styles.optionDescription}>Clipping bolts</Text>
              </View>
            </View>
            <Switch
              value={leadClimbing}
              onValueChange={setLeadClimbing}
              trackColor={{ false: SWITCH_OFF_TRACK, true: '#3FA8F5' }}
              thumbColor={leadClimbing ? colors.background : colors.text}
            />
          </TouchableOpacity>
          {leadClimbing && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              {renderGradeSystemToggle(
                ['yds', 'french', 'aus'],
                leadGradeSystem,
                (sys) => { setLeadGradeSystem(sys); setLeadGradeMin(''); setLeadGradeMax(''); },
                { yds: 'YDS', french: 'French', aus: 'AUS' }
              )}
              <View style={styles.gradeRow}>
                <GradePicker value={leadGradeMin} onValueChange={setLeadGradeMin} system={leadGradeSystem} placeholder="Max onsight" style={styles.gradeInput} />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker value={leadGradeMax} onValueChange={setLeadGradeMax} system={leadGradeSystem} placeholder="Max redpoint" style={styles.gradeInput} />
              </View>
            </View>
          )}

          {/* Bouldering */}
          <TouchableOpacity style={styles.optionRow} onPress={() => setBouldering(v => !v)} activeOpacity={0.7}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: bouldering ? 'rgba(245, 63, 110, 0.2)' : 'rgba(245, 63, 110, 0.08)' }]}>
                <Ionicons name="cube" size={22} color="#F53F6E" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Bouldering</Text>
                <Text style={styles.optionDescription}>Pebble wrestling</Text>
              </View>
            </View>
            <Switch
              value={bouldering}
              onValueChange={setBouldering}
              trackColor={{ false: SWITCH_OFF_TRACK, true: '#F53F6E' }}
              thumbColor={bouldering ? colors.background : colors.text}
            />
          </TouchableOpacity>
          {bouldering && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grades</Text>
              {renderGradeSystemToggle(
                ['v_scale', 'font'],
                boulderGradeSystem,
                (sys) => { setBoulderGradeSystem(sys); setBoulderMaxFlash(''); setBoulderMaxSend(''); },
                { v_scale: 'V-Scale', font: 'Font' }
              )}
              <View style={styles.gradeRow}>
                <GradePicker value={boulderMaxFlash} onValueChange={setBoulderMaxFlash} system={boulderGradeSystem} placeholder="Max flash" style={styles.gradeInput} />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker value={boulderMaxSend} onValueChange={setBoulderMaxSend} system={boulderGradeSystem} placeholder="Max send" style={styles.gradeInput} />
              </View>
            </View>
          )}

          {/* Trad */}
          <TouchableOpacity style={[styles.optionRow, styles.optionRowLast]} onPress={() => setTraditionalClimbing(v => !v)} activeOpacity={0.7}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: traditionalClimbing ? 'rgba(160, 63, 245, 0.2)' : 'rgba(160, 63, 245, 0.08)' }]}>
                <Ionicons name="shield-checkmark" size={22} color="#A03FF5" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Trad Climbing</Text>
                <Text style={styles.optionDescription}>Plugging gear</Text>
              </View>
            </View>
            <Switch
              value={traditionalClimbing}
              onValueChange={setTraditionalClimbing}
              trackColor={{ false: SWITCH_OFF_TRACK, true: '#A03FF5' }}
              thumbColor={traditionalClimbing ? colors.background : colors.text}
            />
          </TouchableOpacity>
          {traditionalClimbing && (
            <View style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade range</Text>
              {renderGradeSystemToggle(
                ['yds', 'french', 'aus'],
                traditionalGradeSystem,
                (sys) => { setTraditionalGradeSystem(sys); setTraditionalGradeMin(''); setTraditionalGradeMax(''); },
                { yds: 'YDS', french: 'French', aus: 'AUS' }
              )}
              <View style={styles.gradeRow}>
                <GradePicker value={traditionalGradeMin} onValueChange={setTraditionalGradeMin} system={traditionalGradeSystem} placeholder="Max onsight" style={styles.gradeInput} />
                <Text style={styles.gradeSeparator}>–</Text>
                <GradePicker value={traditionalGradeMax} onValueChange={setTraditionalGradeMax} system={traditionalGradeSystem} placeholder="Max redpoint" style={styles.gradeInput} />
              </View>
            </View>
          )}
        </Card>

        {/* Open to partners */}
        <Card style={styles.sectionCard}>
          <TouchableOpacity style={[styles.optionRow, styles.optionRowLast]} onPress={() => setOpenToNewPartners(v => !v)} activeOpacity={0.7}>
            <View style={styles.optionInfo}>
              <View style={[styles.optionIcon, { backgroundColor: openToNewPartners ? 'rgba(245, 200, 63, 0.2)' : 'rgba(245, 200, 63, 0.08)' }]}>
                <Ionicons name="people" size={22} color="#F5C83F" />
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
              trackColor={{ false: SWITCH_OFF_TRACK, true: '#F5C83F' }}
              thumbColor={openToNewPartners ? colors.background : colors.text}
            />
          </TouchableOpacity>
        </Card>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.infoText}>
            You can add grades, certifications and more from your Profile anytime.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Skip for Now"
          variant="outline"
          onPress={onSkip}
          style={styles.footerBtn}
        />
        <Button
          title={isSaving ? 'Saving…' : 'Continue'}
          onPress={handleSave}
          loading={isSaving}
          variant={hasAnySelection ? 'primary' : 'secondary'}
          style={styles.footerBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginBottom: 28,
  },
  iconContainer: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryMuted,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: colors.textMuted,
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
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  optionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    color: colors.text,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  gradeSection: {
    marginTop: 4,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  gradeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  gradeSystemBtnActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryBorder,
  },
  gradeSystemBtnText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  gradeSystemBtnTextActive: {
    color: colors.primary,
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
    color: colors.textMuted,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  footerBtn: {
    flex: 1,
  },
});

export default OnboardingClimbingProfile;
