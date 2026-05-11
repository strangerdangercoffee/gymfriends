import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * True when the native ExpoContacts module is available.
 * expo-contacts uses the Expo Modules API, which has its own registry —
 * separate from NativeModules and TurboModuleRegistry — so we must use
 * requireOptionalNativeModule (returns null when unlinked, never throws).
 */
export function isExpoContactsNativeLinked(): boolean {
  return requireOptionalNativeModule('ExpoContacts') != null;
}

type ExpoContactsModule = typeof import('expo-contacts');

async function loadExpoContacts(): Promise<ExpoContactsModule | null> {
  if (!isExpoContactsNativeLinked()) return null;
  try {
    return await import('expo-contacts');
  } catch {
    return null;
  }
}

/** Digits only, US-style: strip leading 1 if 11 digits. */
export function normalizeInvitePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function isValidInvitePhone(normalized: string): boolean {
  return normalized.length >= 10 && normalized.length <= 15;
}

export type ContactPhoneRow = {
  id: string;
  name: string;
  phoneDisplay: string;
  normalized: string;
};

export async function requestContactsAccess(): Promise<boolean> {
  const Contacts = await loadExpoContacts();
  if (!Contacts) return false;
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Loads contacts with at least one phone, flattened to one row per number.
 * Dedupes by normalized digits (first occurrence wins).
 */
export async function loadContactPhoneRows(): Promise<ContactPhoneRow[]> {
  const Contacts = await loadExpoContacts();
  if (!Contacts) return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    pageSize: 0,
  });

  const rows: ContactPhoneRow[] = [];
  const seenNorm = new Set<string>();

  for (const c of data) {
    const name =
      (c.name && c.name.trim()) ||
      [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
      'Unknown';
    const phones = c.phoneNumbers ?? [];
    phones.forEach((p, i) => {
      const raw = p.number;
      if (!raw) return;
      const normalized = normalizeInvitePhone(raw);
      if (!isValidInvitePhone(normalized)) return;
      if (seenNorm.has(normalized)) return;
      seenNorm.add(normalized);
      rows.push({
        id: `${c.id}-${i}`,
        name,
        phoneDisplay: raw.trim(),
        normalized,
      });
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return rows;
}
