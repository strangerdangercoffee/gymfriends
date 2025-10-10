# Auto Check-In Quick Start Guide

## 🎉 Welcome to Auto Check-In!

Never forget to check in at the gym again. With Auto Check-In, your phone automatically checks you in when you arrive at your gym - no tapping required!

## ⚡ Quick Setup (2 minutes)

### Step 1: Run the Database Migration

Before using this feature, update your database:

```bash
# Navigate to your project directory
cd /path/to/gymfriends

# Run the migration (choose one method):

# Method 1: Using psql command line
psql your_database_url < scripts/add-auto-checkin-setting.sql

# Method 2: Using Supabase dashboard
# - Go to your Supabase project
# - Click on "SQL Editor"
# - Copy and paste contents of scripts/add-auto-checkin-setting.sql
# - Click "Run"
```

### Step 2: Follow Your Gyms

1. Open the app
2. Go to the **Gyms** tab
3. Find your gym(s)
4. Tap to follow them

> **Note:** Auto check-in only works for gyms you follow!

### Step 3: Enable Auto Check-In

1. Go to the **Profile** tab
2. Scroll to **Privacy Settings**
3. Toggle **Auto Check-In** to ON
4. A modal will appear explaining the feature

### Step 4: Grant Permissions

**iOS:**
1. Tap "Enable Auto Check-In" in the modal
2. When prompted, select **"Allow While Using App"**
3. Later, you'll see another prompt - select **"Change to Always Allow"**

**Android:**
1. Tap "Enable Auto Check-In" in the modal
2. When prompted, select **"Allow all the time"**
3. If asked, enable **Precise location**

### Step 5: Test It Out! 🏃‍♂️

1. Visit one of your followed gyms
2. Wait 30 seconds after arriving
3. Check the app - you should be automatically checked in!
4. Walk 656 feet away from the gym
5. Wait 30 seconds
6. You'll be automatically checked out

## 📱 How to Know It's Working

### Active Indicator
When Auto Check-In is enabled and working, you'll see a green **"Active"** badge in Profile > Privacy Settings > Auto Check-In.

### iOS Status Bar
On iOS, you'll see a blue location indicator in the status bar when background location is active.

### Android Notification
On Android, you'll see a persistent notification that says "GymFriends is tracking your location" when the service is active.

## 🎯 How It Works

### Arrival at Gym
- **Detection Range:** 500 feet (152 meters)
- **Update Frequency:** Every 30 seconds
- **Automatic Actions:**
  - ✅ Checks you in
  - ✅ Updates your status
  - ✅ Notifies your friends (if sharing is enabled)

### Leaving the Gym
- **Detection Range:** 656 feet (200 meters)
- **Update Frequency:** Every 30 seconds
- **Automatic Actions:**
  - ✅ Checks you out
  - ✅ Updates your status
  - ✅ Records your workout duration

## 🔒 Your Privacy

We take your privacy seriously:

- ✅ **Location is only tracked when you enable this feature**
- ✅ **Location is ONLY used to detect when you're at a followed gym**
- ✅ **No location history is stored**
- ✅ **You can turn this off anytime**
- ✅ **All data stays on your device except check-in/check-out events**

## ⚙️ Managing the Feature

### To Disable Auto Check-In
1. Go to **Profile** tab
2. Scroll to **Privacy Settings**
3. Toggle **Auto Check-In** to OFF

### To Change Location Permissions
**iOS:**
1. Go to Settings > GymFriends > Location
2. Choose your preferred setting

**Android:**
1. Go to Settings > Apps > GymFriends > Permissions > Location
2. Choose your preferred setting

### To Temporarily Disable
Just toggle off Auto Check-In in the app. You don't need to change system permissions.

## 🔋 Battery Usage

Auto Check-In is designed to be battery efficient:

- **Balanced Location Accuracy** (not highest precision)
- **Smart Update Intervals** (30 seconds, not continuous)
- **Distance-Based Updates** (only when you move 50+ meters)

**Expected Impact:** 2-5% additional battery drain per day

## 🐛 Troubleshooting

### Problem: Auto Check-In Not Working

**Check the following:**
1. ✅ Auto Check-In is enabled in Profile > Privacy Settings
2. ✅ You see the "Active" badge under Auto Check-In
3. ✅ The gym is in your followed list (Gyms tab)
4. ✅ Background location permission is granted
5. ✅ You're within 500 feet of the gym
6. ✅ You have internet connection

### Problem: Permission Modal Not Appearing

**Solution:**
You may have previously denied permissions. Grant them manually:

**iOS:**
- Settings > GymFriends > Location > Always

**Android:**
- Settings > Apps > GymFriends > Permissions > Location > Allow all the time

Then toggle Auto Check-In off and on again.

### Problem: Checked In But Gym Is Far Away

**Solution:**
This can happen due to GPS drift. Manually check out:
1. Go to Gyms tab
2. Find the gym you're checked into
3. Tap "Check Out"

### Problem: Draining Battery Too Fast

**Solution:**
1. Toggle off Auto Check-In when not needed
2. Or disable feature before sleep/long periods at home
3. Check system settings for battery optimization exclusion (Android)

## 💡 Tips for Best Experience

### Do's ✅
- **Follow your regular gyms** for automatic tracking
- **Enable location sharing** with friends to see each other
- **Keep the app installed** (don't force quit on iOS)
- **Charge overnight** if you work out daily
- **Update the app** regularly for improvements

### Don'ts ❌
- **Don't force quit the app** (iOS) - this stops background tasks
- **Don't enable battery saver** for GymFriends (Android)
- **Don't follow too many gyms** you don't visit
- **Don't expect instant check-in** - can take up to 30 seconds

## 📊 What Gets Shared?

When you check in (automatically or manually):

### With Friends (if location sharing is ON):
- ✅ That you're at the gym
- ✅ Which gym you're at
- ✅ When you checked in

### NOT Shared:
- ❌ Your exact GPS coordinates
- ❌ Your route to/from the gym
- ❌ Any location when you're not at a gym
- ❌ Your home address

## 🆘 Need Help?

### In-App Support
1. Go to Profile tab
2. Look for help/support option
3. Contact us with:
   - Your device model
   - OS version
   - What's not working
   - Screenshots if possible

### Common Questions

**Q: Does this work in airplane mode?**
A: Location detection works, but check-in requires internet.

**Q: What if I forget my phone at home?**
A: No check-in will occur. The feature only works with your phone.

**Q: Can I check in manually instead?**
A: Yes! Manual check-in still works when Auto Check-In is enabled.

**Q: Does this work everywhere in the world?**
A: Yes, as long as your followed gyms have valid GPS coordinates.

**Q: What about privacy at gyms near my home?**
A: You can unfollow gyms or disable Auto Check-In anytime.

## 🎓 Advanced Features

### Multiple Gyms
If multiple followed gyms are nearby, you'll be checked into the closest one.

### Schedule Integration
Auto Check-In works great with your workout schedule. Check in automatically, then track your workout!

### Friend Notifications
Your friends will see when you check in (if you have location sharing enabled).

## 🔄 Updates & Improvements

We're constantly improving Auto Check-In:

**Coming Soon:**
- 📱 Push notifications on auto check-in
- 📊 Check-in statistics and streaks
- 🎯 Smart check-in predictions
- 🔋 Enhanced battery optimization

## ✨ Enjoy Hassle-Free Check-Ins!

That's it! You're all set up. Now go hit the gym and let the app handle the check-ins. 

See you at the gym! 💪

---

**Need more technical details?** Check out `docs/AUTO_CHECKIN_FEATURE.md`


