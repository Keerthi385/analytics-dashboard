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

// ✅ GET /api/vendors/top10
export async function GET() {
  try {
    // Aggregate invoice totals by vendorId
    const data = await prisma.invoice.groupBy({
      by: ["vendorId"],
      _sum: { total: true },
    });

    // Fetch vendor details
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: data.map(d => d.vendorId).filter(Boolean) } },
      select: { id: true, name: true },
    });

    // Combine totals with vendor names and get top 10
    const result = data
      .map(d => ({
        vendor: vendors.find(v => v.id === d.vendorId)?.name || "Unknown Vendor",
        totalSpend: Number(d._sum.total || 0),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    return applyCors(NextResponse.json(result));
  } catch (error) {
    console.error(error);
    return applyCors(
      NextResponse.json({ error: "Failed to fetch top vendors" }, { status: 500 })
    );
  }
}
