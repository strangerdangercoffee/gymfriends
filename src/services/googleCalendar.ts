/**
 * Google Calendar Sync Service
 *
 * Handles the full lifecycle of Google Calendar integration:
 *   1. requestCalendarAccess  — OAuth flow (calendar.readonly scope)
 *   2. hasCalendarAccess      — check if valid tokens exist
 *   3. syncCalendarEvents     — fetch events from GCal and upsert to calendar_busy_blocks
 *   4. refreshAccessToken     — silently renew an expired access token
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP REQUIRED
 * ─────────────────────────────────────────────────────────────────────────────
 * You need a Google OAuth 2.0 Client ID with:
 *   • Authorised redirect URI: https://auth.expo.io/@strangerdanger/gymfriend
 *   • Scopes: openid, email, profile, https://www.googleapis.com/auth/calendar.readonly
 *
 * Place the value in app.json → expo.extra.googleWebClientId (web client)
 * and expo.extra.googleIosClientId (iOS native client).
 *
 * For now we read from the constants below — swap for your real IDs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Complete the auth session so the in-app browser can dismiss itself
WebBrowser.maybeCompleteAuthSession();

// ── Google OAuth Client IDs ────────────────────────────────────────────────
// Replace these with your actual Google Cloud Console credentials.
// Web client ID is used for Expo Go and web; iOS client ID gives a native flow
// on physical iOS devices.
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com';

// ── Constants ──────────────────────────────────────────────────────────────
const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

/** How many seconds before expiry we proactively refresh the token */
const REFRESH_BUFFER_SECONDS = 300;

// ── Types ──────────────────────────────────────────────────────────────────

interface StoredTokens {
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null; // ISO-8601
  calendar_id: string;
}

interface GCalEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  transparency?: string; // "transparent" means "free"
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clientId(): string {
  return Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
}

// Reversed iOS client ID — Google accepts this automatically for native iOS OAuth clients.
// No entry needed in Google Cloud Console; just register the scheme in app.json.
const IOS_REVERSED_CLIENT_ID = 'com.googleusercontent.apps.330440941170-pargj79jl1ims4lv96t42tlqpnrqpsa0';

function makeRedirectUri(): string {
  if (Platform.OS === 'ios') {
    // Native iOS: use the reversed client ID scheme
    return `${IOS_REVERSED_CLIENT_ID}:/oauth2redirect`;
  }
  // Expo Go / Android / web: use the gymfriends scheme.
  // Add https://auth.expo.io/@strangerdanger/gymfriend to your Web client's
  // "Authorized redirect URIs" in Google Cloud Console.
  return AuthSession.makeRedirectUri({
    scheme: 'gymfriends',
    path: 'calendar/callback',
  });
}

/** True if the access token has expired (or will expire within the buffer). */
function isExpired(tokenExpiry: string | null): boolean {
  if (!tokenExpiry) return true;
  const expiresAt = new Date(tokenExpiry).getTime();
  return Date.now() >= expiresAt - REFRESH_BUFFER_SECONDS * 1000;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Launch a Google OAuth flow requesting calendar.readonly access.
 * Stores the resulting tokens in `google_calendar_tokens`.
 *
 * Returns `true` on success, `false` if the user cancelled or an error occurred.
 */
export async function requestCalendarAccess(userId: string): Promise<boolean> {
  try {
    const redirectUri = makeRedirectUri();

    const request = new AuthSession.AuthRequest({
      clientId: clientId(),
      scopes: ['openid', 'email', 'profile', CALENDAR_SCOPE],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: 'offline',
        prompt: 'consent', // force refresh_token to be returned
      },
    });

    // Load and pre-fetch the discovery document
    await request.makeAuthUrlAsync(DISCOVERY);

    const result = await request.promptAsync(DISCOVERY);

    if (result.type !== 'success' || !result.params.code) {
      console.log('[GCal] Auth cancelled or failed:', result.type);
      return false;
    }

    // Exchange the authorization code for tokens.
    // code_verifier is passed via extraParams per the expo-auth-session v7 API.
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        code: result.params.code,
        clientId: clientId(),
        redirectUri,
        extraParams: request.codeVerifier
          ? { code_verifier: request.codeVerifier }
          : undefined,
      },
      { tokenEndpoint: DISCOVERY.tokenEndpoint }
    );

    const expiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
      : null;

    // Upsert into google_calendar_tokens (unique on user_id)
    const { error } = await (supabase as any).from('google_calendar_tokens').upsert(
      {
        user_id: userId,
        access_token: tokenResult.accessToken,
        refresh_token: tokenResult.refreshToken ?? null,
        token_expiry: expiresAt,
        calendar_id: 'primary',
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[GCal] Failed to store tokens:', error);
      return false;
    }

    console.log('[GCal] Calendar access granted and tokens stored for', userId);
    return true;
  } catch (err) {
    console.error('[GCal] requestCalendarAccess error:', err);
    return false;
  }
}

/**
 * Returns true if the user has stored calendar tokens (even if expired —
 * we can refresh them).  Returns false if no tokens exist at all.
 */
export async function hasCalendarAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[GCal] hasCalendarAccess query error:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[GCal] hasCalendarAccess error:', err);
    return false;
  }
}

/**
 * Silently refreshes the access token using the stored refresh_token.
 * Updates the row in `google_calendar_tokens` and returns the new access token,
 * or null if the refresh fails (user will need to re-authorise).
 */
export async function refreshAccessToken(userId: string): Promise<string | null> {
  try {
    const { data: row, error: fetchErr } = await (supabase as any)
      .from('google_calendar_tokens')
      .select('refresh_token, access_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr || !row?.refresh_token) {
      console.warn('[GCal] No refresh_token available for', userId);
      return null;
    }

    const body = new URLSearchParams({
      client_id: clientId(),
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    });

    const response = await fetch(DISCOVERY.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[GCal] Token refresh failed:', response.status, text);
      return null;
    }

    const json = await response.json();
    const newAccessToken: string = json.access_token;
    const expiresAt = json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;

    const { error: updateErr } = await (supabase as any)
      .from('google_calendar_tokens')
      .update({
        access_token: newAccessToken,
        token_expiry: expiresAt,
        // refresh_token usually isn't returned again; keep the existing one
      })
      .eq('user_id', userId);

    if (updateErr) {
      console.error('[GCal] Failed to persist refreshed token:', updateErr);
    }

    console.log('[GCal] Access token refreshed for', userId);
    return newAccessToken;
  } catch (err) {
    console.error('[GCal] refreshAccessToken error:', err);
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 * Returns null if we can't get a valid token.
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: row, error } = await (supabase as any)
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !row) return null;

  // Token still valid
  if (!isExpired(row.token_expiry)) {
    return row.access_token;
  }

  // Need to refresh
  return refreshAccessToken(userId);
}

/**
 * Fetch all non-free events from Google Calendar in the given window,
 * then upsert them into `calendar_busy_blocks`.
 *
 * Idempotent: safe to call multiple times for overlapping windows.
 * Events where `transparency === 'transparent'` (marked "free") are skipped.
 */
export async function syncCalendarEvents(
  userId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      console.warn('[GCal] No valid access token for', userId, '— skipping sync');
      return;
    }

    // Fetch the calendar ID to query (default: 'primary')
    const { data: tokenRow } = await (supabase as any)
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', userId)
      .maybeSingle();

    const calendarId = encodeURIComponent(tokenRow?.calendar_id ?? 'primary');

    const params = new URLSearchParams({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      // Only return events where the user is busy
      fields: 'items(id,summary,start,end,status,transparency)',
    });

    const response = await fetch(
      `${GCAL_BASE}/calendars/${calendarId}/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[GCal] Events fetch failed:', response.status, text);
      return;
    }

    const json = await response.json();
    const events: GCalEvent[] = json.items ?? [];

    // Filter: skip cancelled events and events marked as "free"
    const busyEvents = events.filter(
      (e) => e.status !== 'cancelled' && e.transparency !== 'transparent'
    );

    if (busyEvents.length === 0) {
      console.log('[GCal] No busy events in window for', userId);
      // Still delete stale blocks in this window so they don't linger
      await deleteStaleBlocks(userId, windowStart, windowEnd, []);
      return;
    }

    // Build upsert rows
    const rows = busyEvents.flatMap((event) => {
      const startStr = event.start.dateTime ?? event.start.date;
      const endStr = event.end.dateTime ?? event.end.date;

      if (!startStr || !endStr) return []; // skip malformed events

      // All-day events (date only) — convert to midnight–midnight local-ish times
      const start = new Date(startStr);
      const end = new Date(endStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

      return [
        {
          // Deterministic ID so upserts don't create duplicates
          // We store gcal event IDs via a composite approach using a lookup below
          user_id: userId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          source: 'google' as const,
          // Only share title if the field is populated; apps can redact this
          event_title: event.summary ?? null,
        },
      ];
    });

    // Delete existing google-sourced blocks in this window, then re-insert.
    // This handles event edits/deletions cleanly without needing a gcal event_id column.
    await deleteStaleBlocks(userId, windowStart, windowEnd, []);

    if (rows.length > 0) {
      const { error: insertErr } = await (supabase as any)
        .from('calendar_busy_blocks')
        .insert(rows);

      if (insertErr) {
        console.error('[GCal] Failed to insert busy blocks:', insertErr);
        return;
      }
    }

    console.log(
      `[GCal] Synced ${rows.length} busy block(s) for ${userId} ` +
        `(${windowStart.toDateString()} – ${windowEnd.toDateString()})`
    );
  } catch (err) {
    console.error('[GCal] syncCalendarEvents error:', err);
  }
}

/**
 * Remove all google-sourced busy blocks for a user in the given time window.
 * Pass `gcalEventIds` as an empty array to delete everything in the window.
 */
async function deleteStaleBlocks(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  _gcalEventIds: string[]
): Promise<void> {
  const { error } = await (supabase as any)
    .from('calendar_busy_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'google')
    .gte('start_time', windowStart.toISOString())
    .lt('start_time', windowEnd.toISOString());

  if (error) {
    console.error('[GCal] Failed to delete stale blocks:', error);
  }
}

/**
 * Convenience wrapper: sync the next N weeks of events.
 * Typically called on app foreground and when Find Time screen opens.
 */
export async function syncUpcomingEvents(
  userId: string,
  weeksAhead = 4
): Promise<void> {
  const now = new Date();
  // Start from beginning of today
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + weeksAhead * 7);

  await syncCalendarEvents(userId, windowStart, windowEnd);
}
