# Notification System Implementation

## Installation Required

To enable the notification system, you need to install the following packages:

```bash
npx expo install expo-notifications @react-native-async-storage/async-storage
```

## Features Implemented

### 1. Notification Service (`app/utils/notificationService.ts`)

- Permission handling for iOS and Android
- Daily summary notifications (scheduled at user-preferred time)
- Weekly report notifications (every Monday at 9:00 AM)
- Target income reminders with 3 status types:
  - **Behind**: When user is falling behind target
  - **On-track**: Encouraging messages when user is on pace
  - **Exceeded**: Celebration when target is surpassed
- Milestone notifications:
  - First sale celebration
  - 50% target progress
  - 75% target progress
  - Target achieved (100%)
  - Streak celebrations (3, 7, 14, 30 days)
- Encouragement notifications for inactive users

### 2. Notification Settings UI (`app/notification-settings.tsx`)

- Master enable/disable toggle
- Individual switches for each notification type:
  - Target income reminders
  - Daily summary
  - Weekly report
- Settings persisted in AsyncStorage
- Permission request handling with user-friendly alerts

### 3. Notification Checker (`app/utils/notificationChecker.ts`)

- Monitors target progress and triggers appropriate notifications
- Implements cooldown periods to prevent notification spam:
  - Behind target: Once per 24 hours
  - On-track: Once per week
  - Exceeded: Once per 24 hours
- Milestone tracking to ensure one-time celebrations per month
- Sales activity monitoring for encouragement notifications

### 4. Notification Initialization (`app/utils/notificationInit.ts`)

- Initializes notification system on app start
- Schedules daily and weekly recurring notifications
- First sale detection and celebration

## Integration Points

### App Root Layout (`app/_layout.tsx`)

- Initializes notifications when user logs in and app is unlocked
- Registered notification settings and target income screens

### Dashboard (`app/(tabs)/index.tsx`)

- Monitors target progress changes
- Triggers targetprogress-based notifications automatically
- Loads notification settings from AsyncStorage

### Settings Screen (`app/settings.tsx`)

- Added "Notifications" menu item
- Links to notification preferences screen

### Checkout (`app/checkout.tsx`)

- Checks for first sale after successful transaction
- Sends celebration notification if it's user's first sale

## How It Works

1. **App Initialization**: When user logs in, notification system requests permissions and schedules recurring notifications (daily/weekly summaries)

2. **Target Progress Monitoring**: Dashboard continuously monitors target progress. When progress changes:
   - Loads user's notification preferences
   - Checks if notifications are enabled
   - Determines notification type based on progress status
   - Applies cooldown logic to prevent spam
   - Sends appropriate notification

3. **Milestone Tracking**: System tracks achievements per month:
   - First sale (lifetime achievement)
   - 50%, 75%, 100% target progress
   - Consecutive sales streaks
   - Each milestone celebrated only once

4. **User Control**: Users have full control through notification settings:
   - Can disable all notifications
   - Can selectively enable/disable specific types
   - Settings persist across app restarts

## Testing

After installing the packages:

1. **First Sale**: Complete a transaction in the counter/checkout flow
2. **Target Progress**: Set a target income and record sales/expenses to see progress notifications
3. **Daily Summary**: Scheduled for user's preferred time (default: 6:00 PM)
4. **Weekly Report**: Scheduled for Monday mornings at 9:00 AM
5. **Milestones**: Reach 50%, 75%, 100% of target to see celebrations

## Notes

- Notifications work on both iOS and Android
- Permission request appears on first use
- All notifications are local (not push notifications)
- Notification state persists in AsyncStorage and Convex database
- Smart cooldown prevents notification fatigue
- Motivational messages change based on actual business performance
