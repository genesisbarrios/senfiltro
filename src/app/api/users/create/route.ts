import { NextResponse } from "next/server";
import { getPolkadotAPI } from "@/lib/polkadot";
import { WebSocket } from "ws"; // optional if server-side needed

export async function POST(req: Request) {
  const data = await req.json();
  const { account, username, imageCID } = data;

  if (!account || !username || !imageCID) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const api = await getPolkadotAPI();
  const keyring = require("@polkadot/keyring").Keyring;
  const kr = new keyring({ type: "sr25519" });
  const signer = kr.addFromUri(process.env.APP_SUDO_KEY!);

  // Call the on-chain pallet to set user profile
  const tx = api.tx.senfiltroModule.setProfile(username, imageCID);
  const hash = await tx.signAndSend(signer);

  return NextResponse.json({ txHash: hash.toString() });
}
