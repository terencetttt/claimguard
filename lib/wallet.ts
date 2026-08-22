import { testnetBradbury } from "genlayer-js/chains";

export const BRADBURY = testnetBradbury;
export const BRADBURY_CHAIN_ID = `0x${testnetBradbury.id.toString(16)}`;
export const BRADBURY_LABEL = "Bradbury";

export type Eip1193Provider = {
  request: (request: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

export type InjectedProvider = { id: string; name: string; rdns?: string; icon?: string; provider: Eip1193Provider };

export const WALLET_STORAGE_KEY = "claimguard.wallet.provider.v1";
export const WALLET_CHANNEL_NAME = "claimguard.wallet.session.v1";

export type StoredProviderMetadata = { name: string; rdns?: string };

export function providerMatchesMetadata(provider: InjectedProvider, metadata: StoredProviderMetadata) {
  return metadata.rdns ? provider.rdns === metadata.rdns : provider.name === metadata.name;
}

export function shortenAddress(address: string) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }

export function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "code" in error && error.code === 4001) return "Connection request declined. Your wallet remains disconnected.";
  if (error instanceof Error && error.message) return error.message;
  return "We couldn’t connect to this wallet. Please try again.";
}

export async function switchToBradbury(provider: Eip1193Provider) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BRADBURY_CHAIN_ID }] });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: BRADBURY_CHAIN_ID, chainName: BRADBURY.name, nativeCurrency: BRADBURY.nativeCurrency, rpcUrls: [...BRADBURY.rpcUrls.default.http], blockExplorerUrls: BRADBURY.blockExplorers ? [BRADBURY.blockExplorers.default.url] : [] }] });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BRADBURY_CHAIN_ID }] });
  }
}
