# BizWise App - Feature Implementation Plan

## Overview

This document outlines the implementation plan for 11 major features and improvements requested for the BizWise application. Please review and approve before implementation begins.

---

## ✅ TASK 1: Update Contact Information & Fix UI Issues

### Changes Required:

1. **contact-us.tsx** - Replace social media links with:
   - Email: bizwise.official@gmail.com
   - Phone: +639292305818 (text or call)
2. **help.tsx** - Fix chevron icon casing (currently inconsistent)

### Technical Details:

- Update CONTACT_OPTIONS array in contact-us.tsx
- Replace Facebook, Instagram, WhatsApp, Website with Email (2 entries for different formats) and Phone
- Fix chevron components: `ChevronDown` and `ChevronRight` (ensure proper imports)
- Update linking - `mailto:` for email, `tel:` for phone

### Estimated Time: 30 minutes

---

## ✅ TASK 2: Improve Receipt Scanning with AI Categorization

### Current Implementation:

- Uses OCR.space for text extraction
- Uses Gemini AI + OpenRouter fallback for parsing
- Generic prompts for all receipt types

### Improvements Needed:

1. **Automatic Receipt Type Detection**
   - Add pre-processing to detect receipt type (electricity, grocery, labor, etc.)
   - Use different prompts for each type

2. **Electricity Bill Specific**
   - Auto-detect electricity bill keywords: "MERALCO", "kWh", "electric", "consumption"
   - Auto-title as "Electricity Bill - [Month/Date]"
   - Extract total amount prominently displayed
   - Category: Utilities

3. **Grocery Receipt Specific**
   - Detect multiple items pattern
   - Better line-item parsing
   - Category: Food or General (based on items)

4. **Labor/Services Receipt**
   - Detect service keywords: "labor", "service", "repair", "installation"
   - Category: Maintenance or General

### Technical Implementation:

```typescript
// Add receipt type detection function
const detectReceiptType = (
  ocrText: string,
): "electricity" | "grocery" | "labor" | "general" => {
  const text = ocrText.toLowerCase();
  if (
    text.includes("meralco") ||
    text.includes("kwh") ||
    text.includes("electric")
  ) {
    return "electricity";
  }
  if (
    text.includes("labor") ||
    text.includes("service charge") ||
    text.includes("installation")
  ) {
    return "labor";
  }
  // Count line items - if many items, likely grocery
  const possibleItems = text.split("\n").filter((line) => /\d+/.test(line));
  if (possibleItems.length > 5) {
    return "grocery";
  }
  return "general";
};

// Create specialized prompts
const getReceiptPromptByType = (text: string, type: string) => {
  // Different prompts for each type
};
```

### Backend Changes:

- Update `backend/services/gemini_parser.py` to support receipt type detection
- Add different prompt templates for each receipt type
- Improve amount extraction for utility bills

### Estimated Time: 3-4 hours

---

## ✅ TASK 3: Add Expense Categories for Manual Entry

### Current State:

- Category field exists but is a free-text input
- No predefined categories shown

### Implementation:

1. Add dropdown/picker for expense categories
2. Predefined categories (from AI prompt):
   - Food
   - Office
   - Transportation
   - Utilities
   - Maintenance
   - Marketing
   - Medical
   - Equipment
   - General

### UI Design:

- Replace category TextInput with TouchableOpacity that opens a modal
- Modal shows list of categories with icons
- Allow custom category entry (optional)

### Technical Details:

```typescript
const EXPENSE_CATEGORIES = [
  { id: "food", name: "Food", icon: "utensils", color: "#FF6B6B" },
  { id: "office", name: "Office", icon: "briefcase", color: "#4ECDC4" },
  {
    id: "transportation",
    name: "Transportation",
    icon: "car",
    color: "#95E1D3",
  },
  { id: "utilities", name: "Utilities", icon: "zap", color: "#F38181" },
  { id: "maintenance", name: "Maintenance", icon: "wrench", color: "#AA96DA" },
  { id: "marketing", name: "Marketing", icon: "megaphone", color: "#FCBAD3" },
  { id: "medical", name: "Medical", icon: "heart-pulse", color: "#A8D8EA" },
  { id: "equipment", name: "Equipment", icon: "package", color: "#FDCB6E" },
  { id: "general", name: "General", icon: "folder", color: "#6C5CE7" },
];
```

### Estimated Time: 2 hours

---

## ✅ TASK 4: User-Created Categories for Counter

### Current State:

- Counter has 3 hardcoded categories: Snacks, Rice Meals, Drinks
- Products are assigned to these categories

### New Implementation:

1. Allow users to create custom categories
2. Each user has their own set of categories
3. Default categories provided for new users

### Database Schema Update:

```typescript
// convex/schema.ts - Add new table
categories: defineTable({
  userId: v.id("users"),
  name: v.string(),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
  sortOrder: v.number(),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_sort", ["userId", "sortOrder"]),
```

### UI Changes:

1. Add "Manage Categories" button in counter screen
2. New screen for category management (CRUD operations)
3. Update product creation/editing to use dynamic categories
4. Migration: Convert existing products to new schema

### Convex Functions Needed:

- `categories.ts`:
  - `getCategories(userId)`
  - `addCategory(userId, name, icon, color)`
  - `updateCategory(categoryId, updates)`
  - `deleteCategory(categoryId)` - should handle products reassignment
  - `reorderCategories(userId, newOrder)`

### Estimated Time: 5-6 hours

---

## ✅ TASK 5: Cancel/Back Button for Receipt Scanning

### Current Issue:

- Users stuck when scanning takes too long
- No way to cancel during processing

### Implementation:

1. Add "Cancel" button overlay during scanning
2. Allow user to go back to manual entry
3. Abort ongoing OCR/AI requests

### Technical Details:

```typescript
// Add AbortController for canceling requests
const abortControllerRef = useRef<AbortController | null>(null);

const handleCancelScan = () => {
  // Abort ongoing requests
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }

  // Reset states
  setIsProcessing(false);
  setShowScanAnimation(false);
  setShowCamera(false);
  setCapturedImage(null);
};
```

### UI:

- Add floating "Cancel" / "Back" button during scan animation
- Show processing time counter (so users know it's working)
- Add timeout (e.g., 60 seconds) with automatic fallback

### Estimated Time: 1.5 hours

---

## ✅ TASK 6: Auto-Clear Expense Fields After Saving

### Current Behavior:

- After saving, modal closes or returns to previous screen
- Fields retain old values if user returns

### New Behavior:

1. After successful save, clear all expense fields
2. Reset to single empty expense item
3. Clear captured image and OCR text

### Implementation:

```typescript
const resetExpenseForm = () => {
  setExpenses([{
    id: Date.now().toString(),
    category: "",
    title: "",
    amount: "",
    quantity: "",
    total: "0.00",
  }]);
  setCapturedImage(null);
  setOcrText("");
  setScanComplete(false);
  setScanError(false);
};

// Call after successful save
await addExpenseGroup({...});
resetExpenseForm();
Alert.alert("Success", "Expenses saved successfully!");
```

### Estimated Time: 30 minutes

---

## ✅ TASK 7: Target Income Feature

### Description:

Allow users to set monthly/daily income targets and track progress.

### Database Schema:

```typescript
// Add to users table
targetIncome: v.optional(v.object({
  monthly: v.number(),
  daily: v.optional(v.number()),
  updatedAt: v.number(),
})),
```

### UI Implementation:

1. **Settings Screen**: Add "Target Income" option
2. **New Screen**: Target Income Setup
   - Monthly target input
   - Auto-calculate daily target (monthly / 30)
   - Save to user profile

3. **Dashboard Integration**:
   - Show progress bar on home screen
   - Display: "₱15,000 / ₱50,000 (30%) - 15 days left"
   - Color-coded: Green (on track), Yellow (behind), Red (far behind)

### Analytics Functions:

```typescript
// convex/analytics.ts
export const getTargetProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get current month's income
    // Calculate progress percentage
    // Return remaining amount and days
  },
});
```

### Estimated Time: 3-4 hours

---

## ✅ TASK 8: Notifications System

### Types of Notifications:

1. **Daily Summary** - End of day recap
2. **Low Stock Alert** - When inventory is low (future feature)
3. **Target Reminders** - Behind on income target
4. **Weekly Report** - Every Monday morning

### Implementation Options:

**Option A: Local Notifications (Offline-capable)**

- Use `expo-notifications`
- Schedule notifications locally
- Works offline

**Option B: Push Notifications (Requires server)**

- Use Expo Push Notifications
- Requires backend service
- More reliable, works when app is closed

### Recommended: Start with Local Notifications

```typescript
// Install: expo install expo-notifications
import * as Notifications from "expo-notifications";

// Schedule daily summary at 8 PM
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Daily Summary 📊",
    body: `Today's income: ₱${dailyIncome}. Great job!`,
    data: { screen: "home" },
  },
  trigger: {
    hour: 20,
    minute: 0,
    repeats: true,
  },
});
```

### Features:

1. Notification preferences in Settings
2. Enable/disable each notification type
3. Custom notification times
4. In-app notification center (list of past notifications)

### Estimated Time: 4-5 hours

---

## ✅ TASK 9: Downloadable PDF with Data & Graphs

### Requirements:

- Export financial data as PDF
- Include charts/graphs
- Date range selection
- Share/download options

### Library: `react-native-html-to-pdf`

```bash
npx expo install react-native-html-to-pdf
```

### Implementation:

1. **PDF Template** (HTML):
   - Header with logo and business name
   - Date range
   - Financial summary (income, expenses, profit)
   - Charts rendered as images (using react-native-view-shot)
   - Transaction list
   - Footer with generation date

2. **Chart to Image Conversion**:

   ```typescript
   import { captureRef } from "react-native-view-shot";

   const chartRef = useRef();
   const chartUri = await captureRef(chartRef, {
     format: "png",
     quality: 0.8,
   });
   ```

3. **PDF Generation**:

   ```typescript
   import RNHTMLtoPDF from "react-native-html-to-pdf";

   const generatePDF = async () => {
     const html = buildPDFHTML(data, chartImages);
     const pdf = await RNHTMLtoPDF.convert({
       html,
       fileName: `BizWise_Report_${dateRange}`,
       directory: "Documents",
     });
     return pdf.filePath;
   };
   ```

4. **Sharing**:
   ```typescript
   import * as Sharing from "expo-sharing";
   await Sharing.shareAsync(pdfFilePath);
   ```

### UI:

- Add "Export PDF" button in profile/settings
- Modal for date range selection
- Loading indicator during generation
- Success message with share options

### Estimated Time: 6-7 hours

---

## ✅ TASK 10: Dynamic Graph Analysis Text

### Current Issue:

- Static text below graphs ("Profit grew by 10%...")
- Doesn't change based on actual data
- Shows even when graph is empty

### Implementation:

```typescript
const generateGraphAnalysis = (data: ChartData) => {
  // Check if data is empty
  if (data.every((d) => d.income === 0 && d.expense === 0)) {
    return ""; // No text for empty graph
  }

  // Calculate trend
  const trend = calculateTrend(data);
  const avgIncome = calculateAverage(data.map((d) => d.income));
  const avgExpense = calculateAverage(data.map((d) => d.expense));
  const profitMargin = (((avgIncome - avgExpense) / avgIncome) * 100).toFixed(
    1,
  );

  // Generate insights
  if (trend > 10) {
    return `Excellent! Income is growing by ${trend}% this period. Keep up the great work! 🎉`;
  } else if (trend > 0) {
    return `Good progress! Income increased by ${trend}% with steady expense control. 📈`;
  } else if (trend < -10) {
    return `Income decreased by ${Math.abs(trend)}%. Consider reviewing expenses and boosting sales. 💡`;
  } else {
    return `Income is stable with ${profitMargin}% profit margin. Consistent performance! ✅`;
  }
};

// Usage
const profitAnalysis = useMemo(
  () => generateGraphAnalysis(profitChartData),
  [profitChartData],
);
```

### Analysis Types:

1. **Profit Analysis**:
   - Growth percentage
   - Trend direction
   - Best performing day/week

2. **Income/Expense Analysis**:
   - Balance comparison
   - Expense ratio
   - Spending patterns

3. **Empty State**:
   - Show nothing or helpful tip
   - "Start recording transactions to see insights!"

### Estimated Time: 2-3 hours

---

## ✅ TASK 11: Offline Mode with Sync

### Architecture Overview:

**Offline-First Approach:**

1. Store all data locally (AsyncStorage / SQLite)
2. Queue mutations when offline
3. Sync when connection restored
4. Handle conflicts intelligently

### Implementation Strategy:

#### Phase 1: Local Storage Layer

```typescript
// services/localDB.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

class LocalDB {
  async saveTransaction(transaction: Transaction) {
    const key = `transaction_${transaction.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(transaction));
  }

  async getSyncQueue(): Promise<PendingOperation[]> {
    const queue = await AsyncStorage.getItem("sync_queue");
    return queue ? JSON.parse(queue) : [];
  }

  async addToSyncQueue(operation: PendingOperation) {
    const queue = await this.getSyncQueue();
    queue.push(operation);
    await AsyncStorage.setItem("sync_queue", JSON.stringify(queue));
  }
}
```

#### Phase 2: Network Detection

```typescript
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext<NetworkState>({ isConnected: true });

export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (state.isConnected) {
        syncPendingOperations(); // Auto-sync when online
      }
    });
    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
};
```

#### Phase 3: Sync Queue System

```typescript
interface PendingOperation {
  id: string;
  type: "create" | "update" | "delete";
  table: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

const syncPendingOperations = async () => {
  const queue = await localDB.getSyncQueue();

  for (const operation of queue) {
    try {
      await executeOperation(operation);
      await removeFromQueue(operation.id);
    } catch (error) {
      operation.retryCount++;
      if (operation.retryCount > 3) {
        // Move to failed queue for manual review
        await moveToFailedQueue(operation);
      }
    }
  }
};
```

#### Phase 4: Convex Integration

Since you're using Convex, we can leverage:

- **Optimistic Updates**: Update UI immediately, sync later
- **Subscription Pause**: Pause real-time subscriptions when offline
- **Cache**: Keep last known state in local storage

```typescript
// Wrapper around Convex mutations
const useMutationWithOffline = (mutation: any) => {
  const convexMutation = useMutation(mutation);
  const { isConnected } = useNetwork();

  return async (args: any) => {
    if (isConnected) {
      return await convexMutation(args);
    } else {
      // Queue for later
      await localDB.addToSyncQueue({
        id: generateId(),
        type: "create",
        table: mutation.name,
        data: args,
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Update local state optimistically
      await localDB.saveTransaction(args);
    }
  };
};
```

### UI Indicators:

1. **Status Bar**: Show "Offline" badge when disconnected
2. **Sync Icon**: Show sync status (syncing, queued items, last sync time)
3. **Warning**: Alert users before critical operations when offline
4. **Sync button**: Manual sync trigger

### Data Priority:

- **High**: Sales, Expenses (always queue)
- **Medium**: Product updates (queue)
- **Low**: Profile updates (can wait)

### Conflict Resolution:

- **Last Write Wins**: For simple fields
- **Merge**: For additive operations (expenses, sales)
- **Manual**: Show conflict UI for critical data

### Testing Strategy:

1. Test offline creation
2. Test offline → online sync
3. Test conflict scenarios
4. Test failed sync recovery

### Estimated Time: 10-12 hours (Complex feature)

---

## Implementation Timeline

### Phase 1: Quick Wins (Week 1)

- ✅ Task 1: Contact info & UI fixes (30 min)
- ✅ Task 5: Cancel button (1.5 hours)
- ✅ Task 6: Auto-clear fields (30 min)
- ✅ Task 10: Dynamic graph text (2-3 hours)

**Total: ~5-6 hours**

### Phase 2: Core Improvements (Week 2)

- ✅ Task 2: Improved receipt scanning (3-4 hours)
- ✅ Task 3: Expense categories (2 hours)
- ✅ Task 7: Target income (3-4 hours)

**Total: ~8-10 hours**

### Phase 3: Advanced Features (Week 3)

- ✅ Task 4: User categories for counter (5-6 hours)
- ✅ Task 8: Notifications (4-5 hours)
- ✅ Task 9: PDF export (6-7 hours)

**Total: ~15-18 hours**

### Phase 4: Offline Functionality (Week 4)

- ✅ Task 11: Offline mode with sync (10-12 hours)

**Total: ~10-12 hours**

---

## Total Estimated Time: 38-46 hours

## Dependencies to Install

```bash
# Notifications
npx expo install expo-notifications

# PDF Generation
npx expo install react-native-html-to-pdf react-native-view-shot

# Offline Support
npx expo install @react-native-async-storage/async-storage @react-native-community/netinfo

# Sharing
npx expo install expo-sharing
```

---

## Risk Assessment

### Low Risk:

- Tasks 1, 5, 6, 10 (UI/UX improvements)

### Medium Risk:

- Tasks 2, 3, 7, 8 (Feature additions)
- May require iteration based on user feedback

### High Risk:

- Task 4 (Schema changes, data migration)
- Task 9 (PDF rendering complexity)
- Task 11 (Offline sync conflicts)

---

## Testing Checklist

- [ ] All features work online
- [ ] Offline mode functions correctly
- [ ] Sync works after reconnection
- [ ] Receipt scanning improved for different types
- [ ] Categories work for both expenses and counter
- [ ] Notifications fire at correct times
- [ ] PDF exports correctly with all data
- [ ] Graph analysis is accurate and dynamic
- [ ] No data loss during offline operations
- [ ] Performance remains smooth with offline layer

---

## Questions for Approval

1. **Sample Account**: Do you want pre-populated sample data for testing?
2. **Category Icons**: Should we use icon packs or custom icons?
3. **Notifications**: Push or Local notifications first?
4. **PDF Design**: Any specific branding/layout preferences?
5. **Offline Priority**: Which features MUST work offline vs. can wait for sync?

---

## Next Steps

Once approved, I will:

1. Start with Phase 1 (quick wins)
2. Provide updates after each phase
3. Create sample data if requested
4. Test thoroughly before moving to next phase

**Please review and approve to proceed with implementation! 🚀**
