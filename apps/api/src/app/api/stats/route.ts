import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ Internal CORS helper
function applyCors(response: NextResponse) {
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

// ✅ GET /api/stats
export async function GET() {
  try {
    const [invoiceCount, totalSpend, documentCount, avgInvoiceValue] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.aggregate({ _sum: { total: true } }),
      prisma.document.count(),
      prisma.invoice.aggregate({ _avg: { total: true } }),
    ]);

    const stats = {
      totalInvoices: invoiceCount,
      totalSpend: Number(totalSpend._sum.total || 0),
      documentsUploaded: documentCount,
      avgInvoiceValue: Number(avgInvoiceValue._avg.total || 0),
    };

    return applyCors(NextResponse.json(stats));
  } catch (error) {
    console.error(error);
    return applyCors(
      NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
    );
  }
}
