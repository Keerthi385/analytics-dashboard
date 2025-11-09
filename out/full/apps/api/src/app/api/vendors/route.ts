import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        invoices: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
