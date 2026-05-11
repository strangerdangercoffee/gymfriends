import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

interface QRCodeDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  groupId?: string;
  groupName?: string;
}

const QRCodeDisplayModal: React.FC<QRCodeDisplayModalProps> = ({
  visible,
  onClose,
  groupId,
  groupName,
}) => {
  const { user } = useAuth();

  if (!user) return null;

  // TODO: Update DOWNLOAD_URL to the App Store URL before going to production.
  const DOWNLOAD_URL = 'https://testflight.apple.com/join/xuBRrEyj';

  // QR value is a URL so that users without the app are sent to TestFlight when
  // they scan with the iOS/Android camera app. The in-app scanner reads the
  // gf_* params to extract the invite payload (see QRCodeScannerModal).
  const qrData = groupId
    ? `${DOWNLOAD_URL}?gf_type=gymfriends_group_invitation&gf_groupId=${encodeURIComponent(groupId)}&gf_groupName=${encodeURIComponent(groupName || 'Group')}`
    : `${DOWNLOAD_URL}?gf_type=gymfriends_user&gf_userId=${encodeURIComponent(user.id)}&gf_name=${encodeURIComponent(user.name)}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>My QR Code</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* User/Group Info */}
          <View style={styles.userInfo}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons 
                name={groupId ? "people" : "person"} 
                size={40} 
                color={colors.primary} 
              />
            </View>
            {groupId ? (
              <>
                <Text style={styles.userName}>{groupName || 'Group'}</Text>
                <Text style={styles.userEmail}>Group Invitation QR Code</Text>
              </>
            ) : (
              <>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </>
            )}
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={qrData}
                size={250}
                color="#000000"
                backgroundColor="#FFFFFF"
                logo={require('../../assets/icon.png')}
                logoSize={50}
                logoBackgroundColor="#FFFFFF"
                logoBorderRadius={10}
              />
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <View style={styles.iconRow}>
              <Ionicons name="scan" size={24} color={colors.primary} />
            </View>
            <Text style={styles.instructionsTitle}>
              {groupId ? 'How to Join Group' : 'How to Add Friends'}
            </Text>
            <Text style={styles.instructionsText}>
              {groupId
                ? 'Have someone scan this QR code with their GymFriends app to instantly join this group!'
                : 'Have your friend scan this QR code with their GymFriends app to instantly become friends!'}
            </Text>
            
            <View style={styles.tipContainer}>
              <Ionicons name="bulb-outline" size={20} color={colors.secondary} />
              <Text style={styles.tipText}>
                Tip: Keep your screen brightness high for easier scanning
              </Text>
            </View>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>No approval needed</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={20} color={colors.success} />
              <Text style={styles.featureText}>Instant connection</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.featureText}>Secure & private</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textMuted,
  },
  qrContainer: {
    marginBottom: 32,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: colors.text,
    borderRadius: 20,
    shadowColor: colors.background,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionsContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    width: '100%',
    shadowColor: colors.background,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  iconRow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  tipText: {
    fontSize: 14,
    color: colors.secondary,
    marginLeft: 8,
    flex: 1,
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.background,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default QRCodeDisplayModal;

