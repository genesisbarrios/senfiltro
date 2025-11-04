import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    await connectMongo();
  } catch (err) {
    console.error("DB connect error (GET /api/get-user):", err);
    return NextResponse.json({ error: "Database connection error" }, { status: 500 });
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");

  // Public read by wallet (no auth required)
  if (wallet) {
    try {
      const user = await User.findOne({ walletAddress: wallet }).lean();
      return NextResponse.json({ data: user ?? null }, { status: 200 });
    } catch (err) {
      console.error("GET by wallet error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // No wallet specified — return null (no NextAuth calls)
  return NextResponse.json({ data: null }, { status: 200 });
}