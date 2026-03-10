# Trip Planning Plan – Updates and Clarifications

This document records updates to the Trip Planning and Area Presence plan based on your feedback.

---

## 2.2 Trip announcement visibility (friend-gated)

**Requirement:** A `trip_announcement` by user1 must only be visible to users who are **friends with user1** (e.g. user2), and **not** visible to user3 who is not friends with user1.

**Implications:**

- **DB/RLS:** Area feed RLS for `area_feed_posts` must restrict `trip_announcement` posts so that only the author’s friends can see them. Current RLS allows viewing posts for an area if the user follows the area or has an active visit. For `post_type = 'trip_announcement'`, add an extra condition: viewer must be friends with `author_user_id` (e.g. via `user_friendships`). Other post types (belayer_request, etc.) can keep current behavior (area follow or visit).
- **API:** No change to who can create; only SELECT policy changes so that when user3 fetches the area feed, `trip_announcement` posts from non-friends are filtered out (either in RLS or by filtering in the API after fetch).
- **Recommendation:** Implement in RLS: for rows with `post_type = 'trip_announcement'`, require `EXISTS (SELECT 1 FROM user_friendships WHERE (user_id = auth.uid() AND friend_id = author_user_id) OR (friend_id = auth.uid() AND user_id = author_user_id))`. So trip announcements are friend-gated; other area feed content remains area-follow/visit gated.

---

## 2. Tell the homies – notifications

**Clarifications:**

- **Who gets notified:** Notify **all friends** (not only area followers).
- **User control:** Users must be able to **toggle** these notifications (e.g. “Friend trip announcements” or “When friends share trip plans”). If they turn it off, they should not receive push/in-app notifications for “Tell the homies” announcements.

**Implications:**

- **Notification preferences:** Add a preference (e.g. `friend_trip_announcements: boolean`) to the existing notification preferences surface (e.g. [NotificationPreferences](src/types/index.ts) and DB table if it exists). When sending “Tell the homies” notifications, only send to friends who have this preference enabled (and who have push tokens if doing push).
- **UI:** Expose this toggle in the same place as other notification settings (e.g. Profile or Settings).

---

## 6. Feed picker for ~15 gyms/areas

**Context:** Users may follow on the order of ~15 gyms/areas combined. A single horizontal chip list may get crowded.

**Chosen approach: auto-completing search bar**

- Use an **autocomplete search bar** over the user’s followed gyms and areas (combined list). User types, list filters to matching gym/area names; selecting an item shows that feed below.
- **Benefits:** Scales to 15+ items, quick to find a specific gym/area, one control for both gyms and areas.
- **Implementation sketch:** One search/input; state = `selectedGym | selectedArea | null`. Data source = `followedGyms` + `followedAreas` (with a label or type so the list can show “Gym: X” vs “Area: Y” if desired). Filter by `name` (and maybe region) as the user types; on select, set selected entity and render `AreaFeed` with either `gymId` or `areaId`. Empty state when nothing selected: prompt to type to choose a gym or area.

**Alternative (if you reconsider later):** Grouped dropdown with search (e.g. “Gyms” section and “Areas” section, same search filtering both). Or a single scrollable list with section headers “Gyms” / “Areas” and sticky headers; no search if 15 is acceptable. The autocomplete search is the recommended primary for ~15 items and growth beyond that.

---

## Summary of plan section changes

| Section | Update |
|--------|--------|
| 2.2 Area feed post visibility | `trip_announcement` visible only to **friends of the author**; enforce via RLS (and optionally API filter). |
| 2 Tell the homies | Notify **all friends**; add **user-toggleable** notification preference for friend trip announcements and respect it when sending. |
| 6 Feeds section | Use an **autocomplete search bar** over followed gyms + areas (one combined list) for the feed picker; show selected gym/area feed below. |
