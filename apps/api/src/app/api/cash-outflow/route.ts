import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

const prisma = new PrismaClient();

// ✅ Apply CORS headers to a response
function applyCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// Handle CORS preflight requests
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
    const invoices = await prisma.invoice.findMany({
      where: {
        dueDate: { not: null },
        total: { gt: 0 },
      },
      select: { dueDate: true, total: true, status: true },
    });

    const forecast: Record<string, number> = {};

    for (const inv of invoices) {
      const due = dayjs(inv.dueDate);
      if (!due.isValid()) continue;

      const key = due.format("YYYY-MM"); // month-year format
      forecast[key] = (forecast[key] || 0) + Number(inv.total || 0);
    }

    const result = Object.entries(forecast)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ✅ Apply CORS before returning
    return applyCors(NextResponse.json(result));

  } catch (error) {
    console.error(error);
    return applyCors(
      NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    );
  }
}
