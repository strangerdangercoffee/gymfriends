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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';

const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, signInWithApple, isLoading } = useAuth();
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
          <Text style={styles.title}>Gym Friends</Text>
          <Text style={styles.subtitle}>
            Connect with friends and coordinate your gym visits
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Text>

          {isSignUp && (
            <Input
              label="Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
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
            />
          )}

          <Button
            title={isSignUp ? 'Create Account' : 'Sign In'}
            onPress={handleSubmit}
            loading={isLoading}
            style={styles.submitButton}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={20} color="#FFF" />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFF" />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <Button
              title={isSignUp ? 'Sign In' : 'Sign Up'}
              variant="outline"
              onPress={toggleMode}
              style={styles.toggleButton}
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 24,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  toggleContainer: {
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 16,
    color: '#8E8E93',
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
    backgroundColor: '#E5E5E7',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
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
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  features: {
    alignItems: 'center',
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
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
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

export default AuthScreen;

