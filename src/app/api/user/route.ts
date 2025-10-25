import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../libs/next-auth";
import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic'; // Ensures dynamic behavior

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  await connectMongo();
  const id = session.user.id;

  try {
    const formData = await req.formData();

    const user = await User.findOne({ _id: id });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // safe helpers for reading FormData values
    const getString = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" ? v : null;
    };
    const getBoolean = (k: string) => {
      const v = formData.get(k);
      if (v === "true") return true;
      if (v === "false") return false;
      return null;
    };

    // Update user fields from form data (guard types)
    const walletAddress = getString("walletAddress");
    if (walletAddress !== null) user.walletAddress = walletAddress;

    const name = getString("name");
    if (name !== null) user.name = name;

    const username = getString("username");
    if (username !== null) user.username = username;

    const email = getString("email");
    if (email !== null) user.email = email;

    const displayEmailBool = getBoolean("displayEmail");
    if (displayEmailBool !== null) user.displayEmail = displayEmailBool;

    const location = getString("location");
    if (location !== null) user.location = location;

    const website = getString("website");
    if (website !== null) user.website = website;

    const bio = getString("bio");
    if (bio !== null) user.bio = bio;

    const socialsRaw = formData.get("socials");
    if (socialsRaw != null) {
      let socialsArr: string[] = [];

      if (typeof socialsRaw === "string") {
        const str = socialsRaw.trim();

        // try parse JSON first
        try {
          const parsed = JSON.parse(str);
          if (Array.isArray(parsed)) {
            socialsArr = parsed.map((s) => String(s).trim()).filter(Boolean);
          } else if (parsed) {
            socialsArr = [String(parsed).trim()];
          }
        } catch {
          // fallback: comma separated or single value
          if (str.includes(",")) {
            socialsArr = str.split(",").map((s) => s.trim()).filter(Boolean);
          } else if (str) {
            socialsArr = [str];
          }
        }
      } else if (socialsRaw instanceof File) {
        // ignore files for socials (not expected) — keep existing socials
        socialsArr = user.socials ?? [];
      } else {
        // other types shouldn't happen, keep existing
        socialsArr = user.socials ?? [];
      }

      user.socials = socialsArr;
    }
    
    await user.save();

    return NextResponse.json({ data: user }, { status: 200 });
  } catch (error) {
    console.error("Error handling form data:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
