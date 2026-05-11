import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import {
  isExpoContactsNativeLinked,
  loadContactPhoneRows,
  requestContactsAccess,
  type ContactPhoneRow,
} from '../utils/contactsInvite';

export interface ContactsPickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Fires when user selects a contact phone line */
  onPick: (row: ContactPhoneRow) => void;
  /** If true, keep modal open after a pick (e.g. onboarding multiple invites) */
  keepOpenAfterPick?: boolean;
  title?: string;
}

const ContactsPickerModal: React.FC<ContactsPickerModalProps> = ({
  visible,
  onClose,
  onPick,
  keepOpenAfterPick = false,
  title = 'Choose from contacts',
}) => {
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [nativeMissing, setNativeMissing] = useState(false);
  const [rows, setRows] = useState<ContactPhoneRow[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    setNativeMissing(false);
    try {
      if (!isExpoContactsNativeLinked()) {
        setNativeMissing(true);
        setRows([]);
        return;
      }
      const ok = await requestContactsAccess();
      if (!ok) {
        setDenied(true);
        setRows([]);
        return;
      }
      const list = await loadContactPhoneRows();
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      load();
    }
  }, [visible, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phoneDisplay.toLowerCase().includes(q) ||
        r.normalized.includes(q.replace(/\D/g, ''))
    );
  }, [rows, query]);

  const handleSelect = (row: ContactPhoneRow) => {
    onPick(row);
    if (!keepOpenAfterPick) {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name or number"
              placeholderTextColor={colors.textFaded}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : nativeMissing ? (
            <View style={styles.centered}>
              <Text style={styles.hint}>
                Contacts need a build that includes expo-contacts. Run{' '}
                <Text style={styles.hintMono}>npx expo run:ios</Text> or{' '}
                <Text style={styles.hintMono}>npx expo run:android</Text> (or your EAS dev client),
                then try again. You can still invite by typing a phone number.
              </Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Check again</Text>
              </TouchableOpacity>
            </View>
          ) : denied ? (
            <View style={styles.centered}>
              <Text style={styles.hint}>
                Contacts access is off. Enable it in Settings to pick people to invite.
              </Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No contacts match your search.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="person" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowPhone} numberOfLines={1}>
                      {item.phoneDisplay}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowPhone: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  centered: {
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  hint: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  hintMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: colors.text,
  },
  retryBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: 24,
  },
});

export default ContactsPickerModal;
