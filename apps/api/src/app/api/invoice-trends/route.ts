import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

const prisma = new PrismaClient();


export function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
// ✅ Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}


export async function GET() {
  try {
    // Fetch all invoices with their total + issueDate
    const invoices = await prisma.invoice.findMany({
      select: { issueDate: true, total: true },
      where: { issueDate: { not: null } },
    });

    // Group by month (YYYY-MM)
    const monthlyData: Record<string, { count: number; total: number }> = {};

    invoices.forEach((invoice) => {
      const month = dayjs(invoice.issueDate).format("YYYY-MM");
      if (!monthlyData[month]) monthlyData[month] = { count: 0, total: 0 };
      monthlyData[month].count += 1;
      monthlyData[month].total += Number(invoice.total) || 0;
    });

    // Convert to sorted array for charts
    const chartData = Object.entries(monthlyData)
      .map(([month, values]) => ({
        month,
        invoiceCount: values.count,
        totalSpend: Number(values.total.toFixed(2)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return withCors(NextResponse.json(chartData));

  } catch (error) {
    console.error(error);
    return withCors(NextResponse.json({ error: "Failed to fetch ..." }, { status: 500 }));

  }
}
