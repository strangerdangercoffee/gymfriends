import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { colors } from '../theme/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputContainerStyle = [
    styles.inputContainer,
    isFocused && styles.focused,
    error && styles.error,
    containerStyle,
  ];

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <View style={inputContainerStyle}>
        <TextInput
          style={[styles.input, inputStyle]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={colors.textFaded}
          {...props}
        />
      </View>
      {error && <Text style={[styles.errorText, errorStyle]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  error: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
  },
});

export default Input;

