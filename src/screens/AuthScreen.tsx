import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
/** From `src/screens` → up to project root → `assets/Logo.png` */
const LOGO = require('../../assets/Logo.png');

const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, signInWithApple, isLoading } = useAuth();
  const [step, setStep] = useState<'choose' | 'email'>(() => 'choose');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
    }

    try {
      if (isSignUp) {
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
  };

  const openEmailAuth = () => {
    setStep('email');
    // Default to Sign In when entering email flow
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
  };

  const backToChooser = () => {
    setStep('choose');
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.subtitle}>
            Climb harder together
          </Text>
        </View>

        <Card style={styles.formCard}>
          {step === 'choose' ? (
            <>
              <View style={styles.socialButtons}>
                <TouchableOpacity
                  style={[styles.socialButton, styles.emailButton]}
                  onPress={openEmailAuth}
                  disabled={isLoading}
                >
                  <Ionicons name="mail-outline" size={20} color={colors.text} />
                  <Text style={styles.socialButtonText}>Continue with Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialButton, styles.googleButton]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={20} color={colors.text} />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.socialButton, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={isLoading}
                  >
                    <Ionicons name="logo-apple" size={20} color={colors.text} />
                    <Text style={styles.socialButtonText}>Continue with Apple</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.emailHeader}>
                <TouchableOpacity onPress={backToChooser} hitSlop={12} disabled={isLoading}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.formTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                <View style={{ width: 22 }} />
              </View>

              {isSignUp && (
                <Input
                  label="Name"
                  placeholder="Enter your name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  labelStyle={styles.inputLabel}
                  inputStyle={styles.inputText}
                />
              )}

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                labelStyle={styles.inputLabel}
                inputStyle={styles.inputText}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="none"
                autoComplete="off"
                labelStyle={styles.inputLabel}
                inputStyle={styles.inputText}
              />

              {isSignUp && (
                <Input
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="none"
                  autoComplete="off"
                  labelStyle={styles.inputLabel}
                  inputStyle={styles.inputText}
                />
              )}

              <Button
                title={isSignUp ? 'Create Account' : 'Sign In'}
                onPress={handleSubmit}
                loading={isLoading}
                style={styles.submitButton}
                textStyle={styles.primaryButtonText}
              />

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </Text>
                <Button
                  title={isSignUp ? 'Sign In' : 'Sign Up'}
                  variant="outline"
                  onPress={toggleMode}
                  style={styles.toggleButton}
                  textStyle={styles.outlineButtonText}
                />
              </View>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.nunito.bold,
    fontSize: 32,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.nunito.regular,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    marginBottom: 32,
  },
  formTitle: {
    fontFamily: fonts.nunito.semiBold,
    fontSize: 24,
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  emailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  toggleContainer: {
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: fonts.nunito.regular,
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 12,
  },
  toggleButton: {
    minWidth: 120,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    fontFamily: fonts.nunito.semiBold,
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
  socialButtons: {
    gap: 12,
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 12,
  },
  emailButton: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  googleButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  appleButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  socialButtonText: {
    fontFamily: fonts.nunito.semiBold,
    fontSize: 16,
    color: colors.text,
  },
  features: {
    alignItems: 'center',
  },
  featuresTitle: {
    fontFamily: fonts.nunito.semiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 16,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  featureItem: {
    alignItems: 'center',
    minWidth: 120,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureText: {
    fontFamily: fonts.nunito.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  inputLabel: {
    fontFamily: fonts.nunito.semiBold,
  },
  inputText: {
    fontFamily: fonts.nunito.regular,
  },
  primaryButtonText: {
    fontFamily: fonts.nunito.semiBold,
  },
  outlineButtonText: {
    fontFamily: fonts.nunito.semiBold,
  },
});

export default AuthScreen;

