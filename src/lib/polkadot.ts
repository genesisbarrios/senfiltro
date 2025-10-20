import { ApiPromise, WsProvider } from "@polkadot/api";

let api: ApiPromise | null = null;

export async function getPolkadotAPI() {
  if (api) return api;
  const provider = new WsProvider("wss://rpc.polkadot.io"); // or your testnet node
  api = await ApiPromise.create({ provider });
  return api;
}
