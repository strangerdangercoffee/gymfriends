# Claude Code — Project Notes

## Branch conventions

- **Development target branch: `develop`**
  All changes should be pushed to `develop`, not `main`/`master`.
  Never push to `main` or `master` without explicit user permission.

## Push access

Git egress via the container proxy (127.0.0.1:41729) returns 403 for all writes to github.com —
this is an organisation policy; do not retry.

The GitHub MCP integration (`mcp__github__push_files`) also returns 403 ("Resource not accessible
by integration") for this repository. To fix this the repo owner must grant the Claude Code GitHub
App write access to `strangerdangercoffee/gymfriends` at:
  Settings → Integrations → GitHub Apps → Claude Code → Repository access

Once access is granted, use `mcp__github__push_files` targeting branch `develop`.

## Implemented tickets (commit 6c5819c — local only, not yet pushed)

RAL-1  HomeScreen: "I'm Going" modal — search bar, arrival type toggle, route note, dynamic CTA
RAL-2  HomeScreen: "Who's out today" header taps → FindMain
RAL-3  HomeScreen: unread activity badges per place (AsyncStorage)
RAL-5  GroupChatScreen: members bar + bottom-sheet modal with remove
RAL-6  ProfileScreen: avatar upload (tap to pick, camera badge, hourglass while uploading)
RAL-7  DirectChatScreen + GroupChatScreen: camera button, video upload support
RAL-8  PlanTripModal + InviteFriendsToTripModal: invite groups to trips
RAL-9  GymDetailScreen: active state for Follow/CheckIn, styled New Request button, feed separator
RAL-10 HomeScreen: upcoming workouts section uses 72-hour window, always renders
RAL-11 ProfileScreen: notifications section collapsed by default, chevron toggle
RAL-12 HomeScreen: bell/notifications icon removed from header
RAL-13 HomeScreen: avatar circle taps → Profile screen
