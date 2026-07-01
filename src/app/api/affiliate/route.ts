import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/affiliate - Get affiliate data (admin: all, user: self)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    if (isAdmin) {
      const affiliates = await prisma.affiliatePartner.findMany({
        include: {
          user: { select: { name: true, email: true, phone: true } },
          transactions: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ affiliates });
    } else {
      const affiliate = await prisma.affiliatePartner.findUnique({
        where: { userId: session.user.id },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      return NextResponse.json({ affiliate });
    }
  } catch (error: any) {
    console.error("GET /api/affiliate error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/affiliate - Create affiliate (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, name, type, referralCode, commissionRate, bankAccount, bankName } = body;

    if (!userId || !name || !type || !referralCode || !commissionRate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.affiliatePartner.findUnique({
      where: { referralCode },
    });
    if (existing) {
      return NextResponse.json({ error: "Referral code already exists" }, { status: 400 });
    }

    const affiliate = await prisma.affiliatePartner.create({
      data: { userId, name, type, referralCode, commissionRate: parseFloat(commissionRate), bankAccount, bankName },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });

    return NextResponse.json({ affiliate });
  } catch (error: any) {
    console.error("POST /api/affiliate error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/affiliate - Update affiliate (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "Missing affiliate id" }, { status: 400 });

    const updateData: any = { ...data };
    if (data.commissionRate) updateData.commissionRate = parseFloat(data.commissionRate);

    const affiliate = await prisma.affiliatePartner.update({
      where: { id },
      data: updateData,
      include: { user: { select: { name: true, email: true, phone: true } } },
    });

    return NextResponse.json({ affiliate });
  } catch (error: any) {
    console.error("PATCH /api/affiliate error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
