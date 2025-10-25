// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import User from "@/models/User";
import { getServerSession } from "next-auth/next";
import connectMongo from "@/libs/mongoose";
import { authOptions } from "@/libs/next-auth";
import { NextResponse } from "next/server";
import { NextRequest } from 'next/server';
import { useSession, signOut } from "next-auth/react";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
 
  if (session) {
    await connectMongo();
    console.log('session user id');
    console.log(session.user.id);
    const id = session.user.id;

    try {
      const users = await User.find();
      console.log(users);

      if (!users) {
        return NextResponse.json(
          { error: "User Not Found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { data: users},
        { status: 200 }
      );

    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }
  } else {
    // Not Signed in
    return NextResponse.json(
      { error: "Please Sign In." },
      { status: 401 }
    );
  }
}