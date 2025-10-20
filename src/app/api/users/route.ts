import { NextResponse } from "next/server";
import { getPolkadotAPI } from "@/lib/polkadot";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account");
  if (!account) return NextResponse.json({ error: "No account provided" }, { status: 400 });

  const api = await getPolkadotAPI();
  const profileOpt = await api.query.senfiltroModule.profiles(account);

  if (profileOpt.isSome) {
    const profile = profileOpt.unwrap();
    return NextResponse.json({
      exists: true,
      username: profile.username.toHuman(),
      imageCID: profile.imageCID.toHuman(),
    });
  }

  return NextResponse.json({ exists: false });
}
