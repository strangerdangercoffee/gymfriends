# QR Code Friend Addition Feature - Setup

## Required Packages

Before using the QR code feature, you need to install the required packages:

```bash
npm install expo-camera react-native-qrcode-svg
```

Or with yarn:
```bash
yarn add expo-camera react-native-qrcode-svg
```

## Permissions Required

The QR code scanner requires camera permissions. This is already handled in the code, but users will need to grant camera access when prompted.

## Feature Overview

Users can add friends by:
1. **Showing their QR code** - Display a QR code that contains their user ID
2. **Scanning a friend's QR code** - Use the camera to scan another user's QR code and instantly add them as a friend

No invitation or acceptance is needed - scanning the code is consent enough!

