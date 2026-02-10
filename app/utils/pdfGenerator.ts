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
