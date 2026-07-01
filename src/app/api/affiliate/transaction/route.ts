import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/affiliate/transaction - Add commission transaction (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { affiliatePartnerId, type, amount, notes } = body;

    if (!affiliatePartnerId || !type || amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["EARNED", "PAYOUT"].includes(type)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const transaction = await prisma.commissionTransaction.create({
      data: {
        affiliatePartnerId,
        type,
        amount: parsedAmount,
        notes,
        createdBy: session.user.id,
      },
    });

    const affiliate = await prisma.affiliatePartner.findUnique({ where: { id: affiliatePartnerId } });
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    const newBalance = type === "EARNED"
      ? Number(affiliate.balance) + parsedAmount
      : Number(affiliate.balance) - parsedAmount;

    if (newBalance < 0) {
      await prisma.commissionTransaction.delete({ where: { id: transaction.id } });
      return NextResponse.json({ error: "Insufficient balance for payout" }, { status: 400 });
    }

    await prisma.affiliatePartner.update({
      where: { id: affiliatePartnerId },
      data: { balance: newBalance },
    });

    return NextResponse.json({ transaction, newBalance });
  } catch (error: any) {
    console.error("POST /api/affiliate/transaction error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
