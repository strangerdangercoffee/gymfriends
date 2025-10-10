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
          placeholderTextColor="#8E8E93"
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
    color: '#000',
    marginBottom: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 12,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    color: '#000',
    padding: 0,
  },
  focused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  error: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
});

export default Input;

