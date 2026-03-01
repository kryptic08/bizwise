/**
 * PDF Generation Service
 * Generates PDF reports with business data and charts
 */

import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  productsSold: number;
  averageTransaction: number;
  topProduct?: string;
  topCategory?: string;
}

interface ChartData {
  day: string;
  inc: number;
  exp: number;
}

interface MonthlyData {
  month: string;
  monthNumber: number;
  income: number;
  expense: number;
  profit: number;
  salesCount: number;
  expenseCount: number;
}

/**
 * Generate HTML content for PDF
 */
function generatePDFHTML(
  businessName: string,
  ownerName: string,
  dateRange: string,
  summary: FinancialSummary,
  chartData: ChartData[],
  monthlyData: MonthlyData[],
  headerImage: string,
  footerImage: string,
): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Report - ${businessName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: white;
      color: #1f2937;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #3b6ea5;
      padding-bottom: 20px;
    }
    
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #3b6ea5;
      margin-bottom: 10px;
    }
    
    .subtitle {
      font-size: 18px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .date-range {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 10px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: #3b6ea5;
      margin-bottom: 15px;
      text-transform: uppercase;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .summary-card {
      background: #f0f6fc;
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid #3b6ea5;
    }
    
    .summary-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .summary-value.positive {
      color: #10b981;
    }
    
    .summary-value.negative {
      color: #ef4444;
    }
    
    .chart-placeholder {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      color: #9ca3af;
      min-height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    .data-table th {
      background: #3b6ea5;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
    }
    
    .data-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    
    .data-table tr:hover {
      background: #f9fafb;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    
    .insights {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .insights-title {
      font-weight: bold;
      color: #f59e0b;
      margin-bottom: 8px;
    }
    
    .insights-text {
      color: #78350f;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .header-image {
      width: 100%;
      margin-bottom: 20px;
    }
    
    .footer-image {
      width: 100%;
      margin-top: 40px;
      margin-bottom: 20px;
    }
    
    .line-chart {
      width: 100%;
      height: 300px;
      margin: 20px 0;
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
    }
    
    .monthly-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 12px;
    }
    
    .monthly-table th {
      background: #3b6ea5;
      color: white;
      padding: 10px 8px;
      text-align: center;
      font-weight: 600;
    }
    
    .monthly-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #e5e7eb;
      text-align: center;
    }
    
    .monthly-table tr:nth-child(even) {
      background: #f9fafb;
    }
  </style>
</head>
<body>
  <!-- Header Image -->
  ${headerImage ? `<img src="data:image/png;base64,${headerImage}" alt="Header" class="header-image" />` : ""}

  <div class="header">
    <div class="logo">BizWise</div>
    <div class="subtitle">Business Performance Report</div>
    <div class="subtitle">${businessName}</div>
    <div class="date-range">${dateRange}</div>
    <div class="date-range">Generated on ${currentDate}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Financial Summary</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Income</div>
        <div class="summary-value positive">₱${(summary.totalIncome || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Expenses</div>
        <div class="summary-value negative">₱${(summary.totalExpense || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Net Profit</div>
        <div class="summary-value ${(summary.profit || 0) >= 0 ? "positive" : "negative"}">₱${(summary.profit || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Products Sold</div>
        <div class="summary-value">${summary.productsSold !== undefined ? summary.productsSold.toLocaleString("en-US") : "0"}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Average Transaction</div>
        <div class="summary-value">₱${summary.averageTransaction !== undefined ? summary.averageTransaction.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Top Product</div>
        <div class="summary-value" style="font-size: 18px;">${summary.topProduct || "N/A"}</div>
      </div>
    </div>
    
    ${
      summary.profit > 0
        ? `
    <div class="insights">
      <div class="insights-title">💡 Key Insights</div>
      <div class="insights-text">
        Your business is profitable with a net profit of ₱${(summary.profit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}. 
        Your best-selling product is "${summary.topProduct || "N/A"}" and your top category is "${summary.topCategory || "N/A"}". 
        Continue focusing on these high-performing areas to maximize revenue.
      </div>
    </div>
    `
        : `
    <div class="insights">
      <div class="insights-title">⚠️ Key Insights</div>
      <div class="insights-text">
        Your expenses are currently higher than your income, resulting in a loss of ₱${Math.abs(summary.profit || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}. 
        Consider reviewing your expenses and focusing on increasing sales of your top product "${summary.topProduct || "N/A"}".
      </div>
    </div>
    `
    }
  </div>

  <div class="section">
    <h2 class="section-title">Daily Performance</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Income</th>
          <th>Expenses</th>
          <th>Profit/Loss</th>
        </tr>
      </thead>
      <tbody>
        ${chartData
          .map(
            (item) => `
          <tr>
            <td>${item.day}</td>
            <td style="color: #10b981;">₱${(item.inc || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="color: #ef4444;">₱${(item.exp || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="color: ${(item.inc || 0) - (item.exp || 0) >= 0 ? "#10b981" : "#ef4444"}; font-weight: bold;">
              ₱${((item.inc || 0) - (item.exp || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Monthly Performance Comparison</h2>
    
    <!-- Line Chart -->
    <svg class="line-chart" viewBox="0 0 800 250" xmlns="http://www.w3.org/2000/svg">
      <!-- Grid lines -->
      ${Array.from(
        { length: 6 },
        (_, i) => `
        <line x1="60" y1="${40 + i * 35}" x2="760" y2="${40 + i * 35}" 
          stroke="#e5e7eb" stroke-width="1"/>
      `,
      ).join("")}
      
      <!-- Y-axis labels -->
      ${(() => {
        const maxValue = Math.max(
          ...monthlyData.map((d) => Math.max(d.income, d.expense)),
        );
        const step = Math.ceil(maxValue / 5000) * 1000;
        return Array.from({ length: 6 }, (_, i) => {
          const value = step * (5 - i);
          return `<text x="50" y="${44 + i * 35}" text-anchor="end" font-size="10" fill="#6b7280">
            ₱${(value / 1000).toFixed(0)}k
          </text>`;
        }).join("");
      })()}
      
      <!-- Income line -->
      <polyline
        fill="none"
        stroke="#10b981"
        stroke-width="3"
        points="${monthlyData
          .map((d, i) => {
            const x = 60 + (i * 700) / 11;
            const maxValue = Math.max(
              ...monthlyData.map((d) => Math.max(d.income, d.expense)),
            );
            const y = 215 - (d.income / maxValue) * 175;
            return `${x},${y}`;
          })
          .join(" ")}"
      />
      
      <!-- Expense line -->
      <polyline
        fill="none"
        stroke="#ef4444"
        stroke-width="3"
        points="${monthlyData
          .map((d, i) => {
            const x = 60 + (i * 700) / 11;
            const maxValue = Math.max(
              ...monthlyData.map((d) => Math.max(d.income, d.expense)),
            );
            const y = 215 - (d.expense / maxValue) * 175;
            return `${x},${y}`;
          })
          .join(" ")}"
      />
      
      <!-- X-axis labels -->
      ${monthlyData
        .map(
          (d, i) => `
        <text x="${60 + (i * 700) / 11}" y="235" text-anchor="middle" font-size="9" fill="#6b7280">
          ${d.month.substring(0, 3)}
        </text>
      `,
        )
        .join("")}
      
      <!-- Legend -->
      <rect x="660" y="10" width="15" height="3" fill="#10b981"/>
      <text x="680" y="14" font-size="11" fill="#1f2937">Income</text>
      <rect x="660" y="20" width="15" height="3" fill="#ef4444"/>
      <text x="680" y="24" font-size="11" fill="#1f2937">Expense</text>
    </svg>
    
    <!-- Monthly Table -->
    <table class="monthly-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expenses</th>
          <th>Profit/Loss</th>
          <th>Sales</th>
        </tr>
      </thead>
      <tbody>
        ${monthlyData
          .map(
            (month) => `
          <tr>
            <td style="font-weight: 600;">${month.month}</td>
            <td style="color: #10b981;">₱${month.income.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="color: #ef4444;">₱${month.expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td style="color: ${month.profit >= 0 ? "#10b981" : "#ef4444"}; font-weight: bold;">
              ₱${month.profit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </td>
            <td>${month.salesCount}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <!-- Footer Image -->
  ${footerImage ? `<img src="data:image/png;base64,${footerImage}" alt="Footer" class="footer-image" />` : ""}

  <div class="footer">
    <p>This report was generated by BizWise - Your Business Management Companion</p>
    <p>© ${new Date().getFullYear()} BizWise. All rights reserved.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate and share PDF report
 */
export async function generatePDFReport(
  businessName: string,
  ownerName: string,
  dateRange: string,
  summary: FinancialSummary,
  chartData: ChartData[],
  monthlyData: MonthlyData[],
): Promise<void> {
  try {
    console.log(
      "Generating PDF with summary:",
      JSON.stringify(summary, null, 2),
    );

    // Load and convert header and footer images to base64
    let headerBase64 = "";
    let footerBase64 = "";

    try {
      const headerAsset = Asset.fromModule(
        require("../../assets/images/Header.png"),
      );
      const footerAsset = Asset.fromModule(
        require("../../assets/images/Footer.png"),
      );

      await headerAsset.downloadAsync();
      await footerAsset.downloadAsync();

      const headerUri = headerAsset.localUri || headerAsset.uri;
      const footerUri = footerAsset.localUri || footerAsset.uri;

      if (headerUri) {
        headerBase64 = await FileSystem.readAsStringAsync(headerUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (footerUri) {
        footerBase64 = await FileSystem.readAsStringAsync(footerUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } catch (imageError) {
      console.warn("Could not load header/footer images:", imageError);
      // Continue without images — PDF will still generate
    }

    // Generate HTML content
    const htmlContent = generatePDFHTML(
      businessName,
      ownerName,
      dateRange,
      summary,
      chartData,
      monthlyData,
      headerBase64,
      footerBase64,
    );

    // Create PDF from HTML using expo-print
    console.log("Generating PDF from HTML...");
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    console.log("PDF generated at:", uri);

    // Use share sheet — lets user save to Downloads, Google Drive, email, etc.
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Save Business Report",
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert(
        "PDF Generated",
        "PDF was created but sharing is not available on this device.",
      );
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    Alert.alert("Error", "Failed to generate report. Please try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Financial Report  (Income Statement template)
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlySaleItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  date: number; // unix ms
}

export interface MonthlyExpenseItem {
  category: string;
  description: string;
  amount: number; // line total (price × qty)
  unitPrice?: number; // unit price per item
  quantity?: number;
  date: number; // unix ms
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Assigns a week label (Week 1–5) based on day-of-month. */
function getWeekLabel(date: Date): string {
  const day = date.getDate();
  if (day <= 7) return "Week 1";
  if (day <= 14) return "Week 2";
  if (day <= 21) return "Week 3";
  if (day <= 28) return "Week 4";
  return "Week 5";
}

function fmt(n: number): string {
  return (n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Generates the HTML for the Monthly Financial Report PDF. */
function generateMonthlyReportHTML(
  ownerName: string,
  businessName: string,
  month: number,
  year: number,
  sales: MonthlySaleItem[],
  expenses: MonthlyExpenseItem[],
): string {
  const monthName = MONTH_NAMES[month - 1];

  // ── SALES: group by week, then aggregate per product ─────────────────────
  const WEEK_ORDER = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];

  const salesByWeek: Record<string, MonthlySaleItem[]> = {};
  for (const s of sales) {
    const wk = getWeekLabel(new Date(s.date));
    (salesByWeek[wk] ??= []).push(s);
  }
  const salesGrandTotal = sales.reduce((a, s) => a + s.total, 0);

  // ── EXPENSES: group by week, then per category ────────────────────────────
  const expByWeek: Record<string, MonthlyExpenseItem[]> = {};
  for (const e of expenses) {
    const wk = getWeekLabel(new Date(e.date));
    (expByWeek[wk] ??= []).push(e);
  }
  const expGrandTotal = expenses.reduce((a, e) => a + e.amount, 0);

  // ── Income Statement calculations ─────────────────────────────────────────
  // Aggregate actual totals per category (no hardcoding)
  const categoryTotals: Record<string, number> = {};
  for (const e of expenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }

  // Categories that belong to Cost of Goods Sold
  const COGS_CATS = new Set([
    "Raw Materials",
    "Merchandise Inventory",
    "Construction Materials",
    "Labor & Subcontracting",
    "Packaging Materials",
    "Store Supplies",
  ]);

  const cogsEntries = Object.entries(categoryTotals).filter(([cat]) =>
    COGS_CATS.has(cat),
  );
  const opEntries = Object.entries(categoryTotals).filter(
    ([cat]) => !COGS_CATS.has(cat),
  );
  const totalCOGS = cogsEntries.reduce((a, [, v]) => a + v, 0);
  const totalOp = opEntries.reduce((a, [, v]) => a + v, 0);
  const revenue = salesGrandTotal;
  const grossProfit = revenue - totalCOGS;
  const netProfit = grossProfit - totalOp;
  const isLoss = netProfit < 0;

  // ── Build Sales rows ──────────────────────────────────────────────────────
  const salesRows = WEEK_ORDER.filter((wk) => salesByWeek[wk])
    .map((wk) => {
      const items = salesByWeek[wk];
      const weekTotal = items.reduce((a, s) => a + s.total, 0);

      // Aggregate per product name
      const prodMap: Record<
        string,
        { qty: number; unit: number; total: number }
      > = {};
      for (const s of items) {
        const p = (prodMap[s.name] ??= { qty: 0, unit: s.unitPrice, total: 0 });
        p.qty += s.quantity;
        p.total += s.total;
      }

      const rows = Object.entries(prodMap)
        .map(
          ([name, p]) => `
        <tr>
          <td class="num">${p.qty}</td>
          <td>${name}</td>
          <td class="num">₱${fmt(p.unit)}</td>
          <td class="num">₱${fmt(p.total)}</td>
        </tr>`,
        )
        .join("");

      return `
        <tr class="wk-header"><td colspan="4">${wk}</td></tr>
        ${rows}
        <tr class="sub-row">
          <td colspan="3">Subtotal — ${wk}</td>
          <td class="num">₱${fmt(weekTotal)}</td>
        </tr>`;
    })
    .join("");

  // ── Build Expense rows (per category within each week, one row per item) ───
  const expRows = WEEK_ORDER.filter((wk) => expByWeek[wk])
    .map((wk) => {
      const items = expByWeek[wk];
      const weekTotal = items.reduce((a, e) => a + e.amount, 0);

      // Group items by category for visual section headers only
      const catGroups: Record<string, MonthlyExpenseItem[]> = {};
      for (const e of items) {
        (catGroups[e.category] ??= []).push(e);
      }

      // Each category header followed by one row per individual item
      const catBlocks = Object.entries(catGroups)
        .map(([cat, catItems]) => {
          const itemRows = catItems
            .map((e) => {
              const unit =
                e.unitPrice ??
                (e.quantity && e.quantity > 1
                  ? e.amount / e.quantity
                  : e.amount);
              return `
        <tr>
          <td class="num">${e.quantity ?? 1}</td>
          <td style="padding-left:32px;">${e.description}</td>
          <td class="num">₱${fmt(unit)}</td>
          <td class="num">₱${fmt(e.amount)}</td>
        </tr>`;
            })
            .join("");
          return `
        <tr class="cat-header"><td colspan="4">&nbsp;&nbsp;&nbsp;${cat}</td></tr>
        ${itemRows}`;
        })
        .join("");

      return `
        <tr class="wk-header"><td colspan="4">${wk}</td></tr>
        ${catBlocks}
        <tr class="sub-row">
          <td colspan="3">Subtotal — ${wk}</td>
          <td class="num">₱${fmt(weekTotal)}</td>
        </tr>`;
    })
    .join("");

  // ── HTML ──────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${ownerName.replace(/\s+/g, "")}_${monthName}${year}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    font-family:'Georgia','Times New Roman',serif;
    font-size:12px;
    color:#111;
    background:#fff;
    padding:36px 44px;
    line-height:1.45;
  }

  /* ── Page breaks ── */
  .page-break{page-break-before:always;margin-top:0;}

  /* ── Section heading ── */
  .sec-heading{
    font-size:13px;font-weight:bold;text-transform:uppercase;
    color:#2c527a;border-bottom:2px solid #2c527a;
    padding-bottom:4px;margin-bottom:14px;letter-spacing:.06em;
  }

  /* ── Data tables ── */
  table.dt{
    width:100%;border-collapse:collapse;margin-bottom:20px;
    font-size:11.5px;
  }
  table.dt thead th{
    background:#2c527a;color:#fff;padding:7px 9px;
    font-weight:600;border:1px solid #1e3a5f;
  }
  table.dt thead th:not(:nth-child(2)){text-align:right;}
  table.dt thead th:nth-child(2){text-align:left;}
  table.dt td{
    padding:5px 9px;border:1px solid #d1d5db;
    vertical-align:middle;
  }
  table.dt td.num{text-align:right;}
  table.dt tr.wk-header td{
    background:#dbeafe;font-weight:700;color:#1e3a5f;
    padding:5px 9px;border:1px solid #93c5fd;
  }
  table.dt tr.cat-header td{
    background:#f0f4f8;font-weight:600;color:#374151;
    font-style:italic;padding:4px 9px;border:1px solid #d1d5db;
  }
  table.dt tr.sub-row td{
    background:#f8fafc;font-weight:600;font-style:italic;
    border-top:1px solid #9ca3af;
  }
  table.dt tr.sub-row td:last-child{text-align:right;}
  table.dt tfoot tr td{
    background:#1e3a5f;color:#fff;font-weight:700;
    padding:9px;border:1px solid #1e3a5f;
  }
  table.dt tfoot tr td:last-child{text-align:right;}

  /* ── Income Statement ── */
  .is-wrap{max-width:520px;margin:24px auto 0;}
  .is-head{text-align:center;margin-bottom:8px;}
  .is-bizname{font-size:18px;font-weight:bold;letter-spacing:.04em;}
  hr.is-rule{border:none;border-top:1.5px solid #111;margin:5px 0;}
  .is-title{font-size:12.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.07em;}
  .is-period{font-size:11.5px;margin-top:3px;}

  table.is{
    width:100%;border-collapse:collapse;
    margin-top:16px;font-size:12px;
  }
  table.is td{padding:3px 4px;vertical-align:bottom;}
  .is-lbl td:first-child{font-weight:bold;padding-top:10px;}
  .is-ind td:first-child{padding-left:28px;}
  .is-total td{
    font-weight:bold;border-top:1px solid #6b7280;
    padding-top:5px !important;
  }
  .is-gross td{
    font-weight:bold;font-size:13px;
    border-top:1.5px solid #111;border-bottom:1.5px solid #111;
    padding:7px 4px !important;text-transform:uppercase;
  }
  .is-oplbl td{font-weight:bold;padding-top:10px;}
  .is-net td{
    font-weight:bold;font-size:13.5px;
    border-top:2px solid #111;border-bottom:3px double #111;
    padding:9px 4px !important;text-transform:uppercase;letter-spacing:.04em;
  }
  .is-r{text-align:right;width:32%;}
  .profit{color:#15803d;}
  .loss{color:#b91c1c;}

  /* ── Footer ── */
  .rpt-footer{
    margin-top:36px;border-top:1px solid #d1d5db;
    padding-top:10px;text-align:center;font-size:9.5px;color:#9ca3af;
  }
</style>
</head>
<body>

<!-- ════════════════════════════════════════════════════════════
     SECTION 1 — SALES
═════════════════════════════════════════════════════════════ -->
<div class="sec-heading">Sales &mdash; ${monthName} ${year}</div>

${
  sales.length === 0
    ? `<p style="color:#6b7280;margin-bottom:20px;font-style:italic;">No sales records for ${monthName} ${year}.</p>`
    : `<table class="dt">
  <thead>
    <tr>
      <th style="width:8%;">UNIT</th>
      <th style="width:48%;">PARTICULARS</th>
      <th style="width:22%;">COST/UNIT</th>
      <th style="width:22%;">TOTAL COST</th>
    </tr>
  </thead>
  <tbody>${salesRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="3">SALES GRAND TOTAL</td>
      <td>₱${fmt(salesGrandTotal)}</td>
    </tr>
  </tfoot>
</table>`
}

<!-- ════════════════════════════════════════════════════════════
     SECTION 2 — EXPENSES
═════════════════════════════════════════════════════════════ -->
<div class="sec-heading" style="margin-top:28px;">Expenses &mdash; ${monthName} ${year}</div>

${
  expenses.length === 0
    ? `<p style="color:#6b7280;margin-bottom:20px;font-style:italic;">No expense records for ${monthName} ${year}.</p>`
    : `<table class="dt">
  <thead>
    <tr>
      <th style="width:8%;">UNIT</th>
      <th style="width:48%;">PARTICULARS</th>
      <th style="width:22%;">COST/UNIT</th>
      <th style="width:22%;">TOTAL COST</th>
    </tr>
  </thead>
  <tbody>${expRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="3">EXPENSES GRAND TOTAL</td>
      <td>₱${fmt(expGrandTotal)}</td>
    </tr>
  </tfoot>
</table>`
}

<!-- ════════════════════════════════════════════════════════════
     SECTION 3 — INCOME STATEMENT
═════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>
<div class="is-wrap">

  <div class="is-head">
    <div class="is-bizname">${businessName}</div>
    <hr class="is-rule"/>
    <div class="is-title">Financial Performance (Income Statement)</div>
    <div class="is-period">For the Month of ${monthName} ${year}</div>
    <hr class="is-rule"/>
  </div>

  <table class="is">
  <tbody>

    <tr>
      <td>Revenue</td>
      <td class="is-r">&#8369;${fmt(revenue)}</td>
    </tr>

    <tr class="is-lbl"><td colspan="2">Less: Cost of Goods Sold</td></tr>
    ${cogsEntries
      .map(
        ([cat, total]) => `
    <tr class="is-ind">
      <td>${cat}</td>
      <td class="is-r">&#8369;${fmt(total)}</td>
    </tr>`,
      )
      .join("")}
    <tr class="is-total is-ind">
      <td>Total Cost of Goods Sold</td>
      <td class="is-r">&#8369;${fmt(totalCOGS)}</td>
    </tr>

    <tr class="is-gross">
      <td>Gross Profit</td>
      <td class="is-r ${grossProfit < 0 ? "loss" : "profit"}">&#8369;${fmt(grossProfit)}</td>
    </tr>

    <tr class="is-oplbl"><td colspan="2">Less: Operating Expenses</td></tr>
    ${opEntries
      .filter(([, v]) => v > 0)
      .map(
        ([cat, total]) => `
    <tr class="is-ind"><td>${cat}</td><td class="is-r">&#8369;${fmt(total)}</td></tr>`,
      )
      .join("")}
    <tr class="is-total is-ind">
      <td>Total Operating Expense</td>
      <td class="is-r">&#8369;${fmt(totalOp)}</td>
    </tr>

    <tr class="is-net">
      <td class="${isLoss ? "loss" : "profit"}">${isLoss ? "NET LOSS" : "NET PROFIT"}</td>
      <td class="is-r ${isLoss ? "loss" : "profit"}">&#8369;${fmt(Math.abs(netProfit))}</td>
    </tr>

  </tbody>
  </table>
</div>

<div class="rpt-footer">
  Generated by BizWise &nbsp;&bull;&nbsp; ${ownerName} &nbsp;&bull;&nbsp; ${monthName} ${year}
  &nbsp;&bull;&nbsp; &copy; ${new Date().getFullYear()} BizWise
</div>

</body>
</html>`;
}

/**
 * Generate and share a Monthly Financial Report PDF.
 *
 * @param ownerName    - User's full name  (used in filename and footer)
 * @param businessName - Stall / shop name (used in Income Statement header)
 * @param month        - 1–12
 * @param year         - e.g. 2026
 * @param sales        - Sales for the selected month
 * @param expenses     - Expenses for the selected month
 */
export async function generateMonthlyFinancialReportPDF(
  ownerName: string,
  businessName: string,
  month: number,
  year: number,
  sales: MonthlySaleItem[],
  expenses: MonthlyExpenseItem[],
): Promise<void> {
  if (sales.length === 0 && expenses.length === 0) {
    Alert.alert(
      "No Data",
      `No records found for ${MONTH_NAMES[month - 1]} ${year}.\nPlease select a different month.`,
    );
    return;
  }

  try {
    const html = generateMonthlyReportHTML(
      ownerName,
      businessName,
      month,
      year,
      sales,
      expenses,
    );

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const monthName = MONTH_NAMES[month - 1];
    // Filename: UserName_October2026.pdf  (no spaces)
    const safeName = ownerName.replace(/\s+/g, "");
    const pdfName = `${safeName}_${monthName}${year}.pdf`;

    // Attempt to rename for a friendlier filename in the share sheet
    const dir = uri.substring(0, uri.lastIndexOf("/") + 1);
    const destUri = dir + pdfName;
    try {
      await FileSystem.moveAsync({ from: uri, to: destUri });
    } catch {
      // Rename not critical — share the original
    }

    const fileInfo = await FileSystem.getInfoAsync(destUri);
    const finalUri = fileInfo.exists ? destUri : uri;

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(finalUri, {
        mimeType: "application/pdf",
        dialogTitle: `Save ${pdfName}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("PDF Ready", `Report saved as ${pdfName}.`);
    }
  } catch (error) {
    console.error("Monthly report PDF error:", error);
    Alert.alert("Error", "Failed to generate report. Please try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate profit margin percentage
 */
export function calculateProfitMargin(income: number, expense: number): number {
  if (income === 0) return 0;
  return ((income - expense) / income) * 100;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `₱${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
