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

interface QRCodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (userId: string, userName: string) => Promise<void>;
}

const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
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
      // Parse QR code data
      console.log('Scanned QR code data:', data);
      const qrData = JSON.parse(data);
      console.log('Parsed QR data:', qrData);

      // Validate QR code format
      if (qrData.type !== 'gymfriends_user' || !qrData.userId) {
        console.error('Invalid QR code format:', qrData);
        Alert.alert('Invalid QR Code', 'This is not a valid GymFriends QR code.');
        resetScanner();
        return;
      }

      // Check if user is scanning their own code
      console.log('Checking user IDs - Current:', user?.id, 'Scanned:', qrData.userId);
      if (qrData.userId === user?.id) {
        Alert.alert('Oops!', 'You cannot add yourself as a friend!');
        resetScanner();
        return;
      }

      // Call the onScan callback to add the friend
      console.log('Calling onScan with:', { friendId: qrData.userId, name: qrData.name });
      await onScan(qrData.userId, qrData.name);
      
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
            <ActivityIndicator size="large" color="#007AFF" />
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
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-off" size={64} color="#C7C7CC" />
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
            <Ionicons name="close" size={28} color="#FFF" />
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
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                )}

                {/* Success Indicator */}
                {scanned && !isProcessing && (
                  <View style={styles.successContainer}>
                    <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                    <Text style={styles.successText}>Scanned!</Text>
                  </View>
                )}
              </View>
              <View style={styles.overlaySection} />
            </View>

            {/* Bottom Dark Area with Instructions */}
            <View style={[styles.overlaySection, styles.bottomSection]}>
              <View style={styles.instructionsBox}>
                <Ionicons name="scan" size={32} color="#FFF" />
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
    backgroundColor: '#000',
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
    color: '#FFF',
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
    borderColor: '#007AFF',
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
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  successContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
  },
  successText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
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
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F2F2F7',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default QRCodeScannerModal;

