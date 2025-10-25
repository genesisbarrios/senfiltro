import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import connectMongo from "@/libs/mongoose";
import { authOptions } from "@/libs/next-auth";
import { PinataSDK } from "pinata-web3";
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic'; // Ensures dynamic behavior
// export const bodyParser = false; // Disables the body parser

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { publicId } = await req.json();

    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    // Log the publicId for debugging
    console.log("Deleting image with publicId:", publicId);

    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_API_SECRET;
    const pinataJwt = process.env.PINATA_JWT;

    let pinataClient: any = null;
    if (pinataJwt) {
      pinataClient = new PinataSDK({ jwt: pinataJwt } as any);
    } else if (pinataApiKey && pinataApiSecret) {
      pinataClient = new PinataSDK({ apiKey: pinataApiKey, apiSecret: pinataApiSecret } as any);
    } else {
      console.warn("Pinata credentials not found in env; skipping IPFS unpin.");
    }

    if (pinataClient) {
      try {
        // publicId is expected to be the IPFS hash (CID) pinned to Pinata
        const unpinResult = await pinataClient.unpin(publicId);
        console.log("Pinata unpin result:", unpinResult);
      } catch (pinataError) {
        console.error("Error unpinning from Pinata:", pinataError);
        const details =
          pinataError instanceof Error ? pinataError.message : typeof pinataError === "string" ? pinataError : JSON.stringify(pinataError);
        return NextResponse.json(
          { error: "Failed to unpin from Pinata", details },
          { status: 500 }
        );
      }
    }
    // No Cloudinary response is available in this handler.
    // If you need to delete from Cloudinary or another provider, call it above and handle its result.
    // Proceed assuming remote unpin succeeded.

    return NextResponse.json({ message: "Image deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting image:", error);

    // Normalize unknown error to a safe string for the response
    const details =
      error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);

    // Return detailed error message for debugging
    return NextResponse.json({ error: "Internal Server Error", details }, { status: 500 });
  }
}
