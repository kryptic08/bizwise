import { mutation } from "./_generated/server";

// ONE-TIME MIGRATION: Fix "Sunday leak" records saved before the saleDate/expenseDate fix.
//
// Root cause: Server stored date using new Date().toISOString().slice(0,10) (UTC).
//             Philippines (UTC+8) midnight = UTC 16:00 of the PREVIOUS day.
//             So PH 12:00AM–7:59AM records got dated one day early.
//
// Detection: createdAt UTC hour ≥ 16  AND  stored date === UTC date of createdAt
//            (if date was already correct/local it won't match the UTC date)
//
// Fix: Increment the stored `date` by exactly +1 day.
//
// Safe to run multiple times — already-corrected records won't match detection criteria.
export const fixSundayLeakDates = mutation({
  args: {},
  handler: async (ctx) => {
    // Helper: YYYY-MM-DD from a UTC timestamp (the "wrong" date the server stored)
    const utcDateStr = (ts: number): string => {
      const d = new Date(ts);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Helper: add +1 day to a YYYY-MM-DD string
    const addOneDay = (dateStr: string): string => {
      const d = new Date(dateStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Helper: was this record saved during the Sunday-leak window?
    // Leak window = UTC 16:00–23:59 (= PH 00:00–07:59 next day)
    const isLeaked = (createdAt: number, storedDate: string): boolean => {
      const utcHour = new Date(createdAt).getUTCHours();
      if (utcHour < 16) return false; // Outside leak window
      return storedDate === utcDateStr(createdAt); // Still has the wrong UTC date
    };

    let salesFixed = 0;
    let expensesFixed = 0;

    // ── Fix sales ────────────────────────────────────────────────────────
    const allSales = await ctx.db.query("sales").collect();
    for (const sale of allSales) {
      if (isLeaked(sale.createdAt, sale.date)) {
        await ctx.db.patch(sale._id, { date: addOneDay(sale.date) });
        salesFixed++;
      }
    }

    // ── Fix expenses ─────────────────────────────────────────────────────
    const allExpenses = await ctx.db.query("expenses").collect();
    for (const expense of allExpenses) {
      if (isLeaked(expense.createdAt, expense.date)) {
        await ctx.db.patch(expense._id, { date: addOneDay(expense.date) });
        expensesFixed++;
      }
    }

    return {
      message: "Sunday-leak migration complete",
      salesFixed,
      expensesFixed,
      totalFixed: salesFixed + expensesFixed,
    };
  },
});
