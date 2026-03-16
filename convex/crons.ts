import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "cleanup expired receipt images",
  {
    hourUTC: 0,
    minuteUTC: 0,
  },
  internal.expenses.cleanupExpiredReceiptImages,
);

export default crons;
