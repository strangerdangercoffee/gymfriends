import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OnboardingSlideProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  features?: string[];
}

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  icon,
  title,
  description,
  features = [],
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={80} color="#007AFF" />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      {features.length > 0 && (
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
  },
  featuresContainer: {
    width: '100%',
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 12,
    flex: 1,
  },
});

export default OnboardingSlide;
