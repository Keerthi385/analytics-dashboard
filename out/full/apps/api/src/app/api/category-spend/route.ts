import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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


// GET /api/category-spend
export async function GET() {
  try {
    const lineItems = await prisma.lineItem.findMany({
      select: {
        description: true,
        totalPrice: true,
      },
    });

    // Try grouping categories from descriptions
    const categorySpend: Record<string, number> = {};

    for (const item of lineItems) {
      const desc = item.description?.toLowerCase() || "other";

      let category = "Other";
      if (desc.includes("software")) category = "Software";
      else if (desc.includes("consulting")) category = "Consulting";
      else if (desc.includes("office")) category = "Office Supplies";
      else if (desc.includes("hardware")) category = "Hardware";
      else if (desc.includes("service")) category = "Services";

      categorySpend[category] = (categorySpend[category] || 0) + Number(item.totalPrice || 0);
    }

    const result = Object.entries(categorySpend).map(([category, totalSpend]) => ({
      category,
      totalSpend,
    }));

    return withCors(NextResponse.json(result));

  } catch (error) {
    console.error(error);
    return withCors(NextResponse.json({ error: "Failed to fetch ..." }, { status: 500 }));

  }
}
