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

  // Create QR code data - either group invitation or user info
  const qrData = groupId
    ? JSON.stringify({
        type: 'gymfriends_group_invitation',
        groupId: groupId,
        groupName: groupName || 'Group',
        timestamp: Date.now(),
      })
    : JSON.stringify({
        type: 'gymfriends_user',
        userId: user.id,
        name: user.name,
        timestamp: Date.now(),
      });

  // Debug logging
  if (groupId) {
    console.log('QRCodeDisplayModal: Generating group QR code', { groupId, groupName, qrData });
  }

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
            <Ionicons name="close" size={28} color="#000" />
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
                color="#007AFF" 
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
              <Ionicons name="scan" size={24} color="#007AFF" />
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
              <Ionicons name="bulb-outline" size={20} color="#FF9500" />
              <Text style={styles.tipText}>
                Tip: Keep your screen brightness high for easier scanning
              </Text>
            </View>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.featureText}>No approval needed</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={20} color="#34C759" />
              <Text style={styles.featureText}>Instant connection</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color="#34C759" />
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
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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
    backgroundColor: '#E5F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  qrContainer: {
    marginBottom: 32,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionsContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconRow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
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
    color: '#000',
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default QRCodeDisplayModal;

