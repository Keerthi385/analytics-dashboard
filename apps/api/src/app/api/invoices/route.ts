import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ Internal CORS function (do not export)
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

// ✅ GET all invoices
export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        vendor: true,
        customer: true,
        lineItems: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return applyCors(
      new NextResponse(JSON.stringify(invoices), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    console.error(error);
    return applyCors(
      new NextResponse(JSON.stringify({ error: "Failed to fetch invoices" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}
