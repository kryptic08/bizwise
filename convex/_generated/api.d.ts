/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as categories from "../categories.js";
import type * as clearAndReseedTestUser from "../clearAndReseedTestUser.js";
import type * as clearData from "../clearData.js";
import type * as debugUsers from "../debugUsers.js";
import type * as expenses from "../expenses.js";
import type * as files from "../files.js";
import type * as products from "../products.js";
import type * as sales from "../sales.js";
import type * as seed from "../seed.js";
import type * as seedForCurrentUser from "../seedForCurrentUser.js";
import type * as seedTestAccount from "../seedTestAccount.js";
import type * as seedTransactions from "../seedTransactions.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  categories: typeof categories;
  clearAndReseedTestUser: typeof clearAndReseedTestUser;
  clearData: typeof clearData;
  debugUsers: typeof debugUsers;
  expenses: typeof expenses;
  files: typeof files;
  products: typeof products;
  sales: typeof sales;
  seed: typeof seed;
  seedForCurrentUser: typeof seedForCurrentUser;
  seedTestAccount: typeof seedTestAccount;
  seedTransactions: typeof seedTransactions;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
