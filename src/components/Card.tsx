import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  margin?: number;
  shadow?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 16,
  margin = 0,
  shadow = true,
}) => {
  const cardStyle = [
    styles.card,
    shadow && styles.shadow,
    { padding, margin },
    style,
  ];

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default Card;

