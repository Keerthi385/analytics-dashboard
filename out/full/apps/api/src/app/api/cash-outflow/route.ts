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


// GET /api/cash-outflow
export async function GET() {
  try {
    // Fetch invoices that have due dates and totals
    const invoices = await prisma.invoice.findMany({
      where: {
        dueDate: {
          not: null,
        },
        total: {
          gt: 0,
        },
      },
      select: {
        dueDate: true,
        total: true,
        status: true,
      },
    });

    // Group spend by month or week (next 6 months)
    const forecast: Record<string, number> = {};

    for (const inv of invoices) {
      const due = dayjs(inv.dueDate);
      if (!due.isValid()) continue;

      const key = due.format("YYYY-MM"); // month-year format
      forecast[key] = (forecast[key] || 0) + Number(inv.total || 0);
    }

    // Convert to array format for chart
    const result = Object.entries(forecast)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return withCors(NextResponse.json(result));

  } catch (error) {
    console.error(error);
    return withCors(NextResponse.json({ error: "Failed to fetch ..." }, { status: 500 }));

  }
}
