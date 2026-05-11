import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

interface QRCodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: ((userId: string, userName: string) => Promise<void>) | ((data: string) => Promise<void>);
  mode?: 'user' | 'any'; // 'user' for friend scanning, 'any' for any QR code type
}

const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  mode = 'user',
}) => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      requestCameraPermission();
      setScanned(false);
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      // Parse QR payload — supports two formats:
      //   1. URL format (current): https://testflight.apple.com/join/...?gf_type=...&gf_userId=...
      //   2. Legacy JSON format:   {"type":"gymfriends_user","userId":"...","name":"..."}
      let qrData: Record<string, string>;

      if (data.startsWith('http')) {
        const url = new URL(data);
        const gfType = url.searchParams.get('gf_type');
        if (!gfType) {
          Alert.alert('Invalid QR Code', 'This is not a valid GymFriends QR code.');
          resetScanner();
          return;
        }
        qrData = { type: gfType };
        url.searchParams.forEach((value, key) => {
          if (key.startsWith('gf_') && key !== 'gf_type') {
            // Strip the gf_ prefix so downstream code sees the same keys as the legacy format
            qrData[key.slice(3)] = value;
          }
        });
      } else {
        qrData = JSON.parse(data);
      }

      // If mode is 'any', pass the raw string data to callback (group QR handling)
      if (mode === 'any') {
        if (onScan.length === 1) {
          // Re-serialise extracted payload so group handler gets consistent JSON
          await (onScan as (data: string) => Promise<void>)(JSON.stringify(qrData));
          handleClose();
          return;
        }
      }

      // Validate QR code format for user mode
      if (qrData.type !== 'gymfriends_user' || !qrData.userId) {
        Alert.alert('Invalid QR Code', 'This is not a valid GymFriends user QR code.');
        resetScanner();
        return;
      }

      // Check if user is scanning their own code
      if (qrData.userId === user?.id) {
        Alert.alert('Oops!', 'You cannot add yourself as a friend!');
        resetScanner();
        return;
      }

      await (onScan as (userId: string, userName: string) => Promise<void>)(qrData.userId, qrData.name);

    } catch (error) {
      console.error('Error scanning QR code:', error);
      Alert.alert('Error', 'Failed to process QR code. Please try again.');
      resetScanner();
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setTimeout(() => {
      setScanned(false);
    }, 2000);
  };

  const handleClose = () => {
    setScanned(false);
    setIsProcessing(false);
    onClose();
  };

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Requesting camera permission...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Scan QR Code</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-off" size={64} color={colors.textFaded} />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              Please grant camera permission to scan QR codes.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestCameraPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Camera View */}
        <CameraView
          style={styles.camera}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Scanning Overlay */}
          <View style={styles.overlay}>
            {/* Top Dark Area */}
            <View style={styles.overlaySection} />

            {/* Middle Row with Scanning Frame */}
            <View style={styles.middleRow}>
              <View style={styles.overlaySection} />
              <View style={styles.scanFrame}>
                {/* Corner Borders */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                {/* Scanning Line Animation */}
                {!scanned && !isProcessing && (
                  <View style={styles.scanLineContainer}>
                    <View style={styles.scanLine} />
                  </View>
                )}

                {/* Processing Indicator */}
                {isProcessing && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                )}

                {/* Success Indicator */}
                {scanned && !isProcessing && (
                  <View style={styles.successContainer}>
                    <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                    <Text style={styles.successText}>Scanned!</Text>
                  </View>
                )}
              </View>
              <View style={styles.overlaySection} />
            </View>

            {/* Bottom Dark Area with Instructions */}
            <View style={[styles.overlaySection, styles.bottomSection]}>
              <View style={styles.instructionsBox}>
                <Ionicons name="scan" size={32} color={colors.text} />
                <Text style={styles.instructionTitle}>Position QR Code</Text>
                <Text style={styles.instructionText}>
                  Align the QR code within the frame to scan
                </Text>
              </View>
            </View>
          </View>
        </CameraView>
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
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlaySection: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 300,
  },
  scanFrame: {
    width: 300,
    height: 300,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanLineContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
  },
  scanLine: {
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  processingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  successContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  successText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
  },
  bottomSection: {
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  instructionsBox: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textMuted,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});

export default QRCodeScannerModal;

