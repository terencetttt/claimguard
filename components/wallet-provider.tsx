"use client";

import { createClient } from "genlayer-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BRADBURY,
  BRADBURY_CHAIN_ID,
  WALLET_CHANNEL_NAME,
  WALLET_STORAGE_KEY,
  type Eip1193Provider,
  type InjectedProvider,
  type StoredProviderMetadata,
  getErrorMessage,
  providerMatchesMetadata,
  switchToBradbury,
} from "@/lib/wallet";

type WalletContextValue = {
  address: `0x${string}` | null;
  chainId: string | null;
  client: ReturnType<typeof createClient> | null;
  error: string | null;
  isConnecting: boolean;
  isModalOpen: boolean;
  isOnBradbury: boolean;
  providers: InjectedProvider[];
  connect: (choice: InjectedProvider) => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
declare global { interface Window { ethereum?: Eip1193Provider } }

function readProviderMetadata(): StoredProviderMetadata | null {
  try {
    const value = window.localStorage.getItem(WALLET_STORAGE_KEY);
    return value ? JSON.parse(value) as StoredProviderMetadata : null;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<InjectedProvider[]>([]);
  const [selected, setSelected] = useState<InjectedProvider | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providersRef = useRef<InjectedProvider[]>([]);
  const selectedRef = useRef<InjectedProvider | null>(null);
  const restoreAttemptsRef = useRef(new Set<Eip1193Provider>());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const publishRevalidation = useCallback(() => {
    channelRef.current?.postMessage({ type: "revalidate" });
  }, []);

  const persistProvider = useCallback((choice: InjectedProvider) => {
    const metadata: StoredProviderMetadata = { name: choice.name, ...(choice.rdns ? { rdns: choice.rdns } : {}) };
    window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(metadata));
  }, []);

  const clearSession = useCallback((forgetProvider: boolean, notify = false) => {
    selectedRef.current = null;
    setSelected(null);
    setAddress(null);
    setChainId(null);
    if (forgetProvider) window.localStorage.removeItem(WALLET_STORAGE_KEY);
    if (notify) publishRevalidation();
  }, [publishRevalidation]);

  const restoreFromProvider = useCallback(async (choice: InjectedProvider, persist = true, onlyIfUnselected = false) => {
    try {
      const accounts = await choice.provider.request({ method: "eth_accounts" }) as string[];
      if (!accounts[0]) {
        if (selectedRef.current?.provider === choice.provider) clearSession(true);
        return false;
      }
      if (onlyIfUnselected && selectedRef.current && selectedRef.current.provider !== choice.provider) return false;
      selectedRef.current = choice;
      const currentChainId = String(await choice.provider.request({ method: "eth_chainId" })).toLowerCase();
      setSelected(choice);
      setAddress(accounts[0] as `0x${string}`);
      setChainId(currentChainId);
      if (persist) persistProvider(choice);
      return true;
    } catch {
      if (selectedRef.current?.provider === choice.provider) clearSession(false);
      return false;
    }
  }, [clearSession, persistProvider]);

  const revalidateSession = useCallback(async () => {
    const metadata = readProviderMetadata();
    const choice = metadata
      ? providersRef.current.find((provider) => providerMatchesMetadata(provider, metadata))
      : selectedRef.current;
    if (!choice) {
      if (!metadata) clearSession(false);
      return;
    }
    const restored = await restoreFromProvider(choice, false);
    if (!restored && selectedRef.current?.provider === choice.provider) clearSession(true);
  }, [clearSession, restoreFromProvider]);

  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(WALLET_CHANNEL_NAME);
    channelRef.current = channel;
    const synchronize = () => { void revalidateSession(); };
    const onMessage = (event: MessageEvent<{ type?: string }>) => { if (event.data?.type === "revalidate") synchronize(); };
    const onStorage = (event: StorageEvent) => { if (event.key === WALLET_STORAGE_KEY) synchronize(); };
    const onVisibility = () => { if (document.visibilityState === "visible") synchronize(); };
    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [revalidateSession]);

  useEffect(() => {
    const discovered = new Map<string, InjectedProvider>();
    const add = (choice: InjectedProvider) => {
      const existing = [...discovered.entries()].find(([, item]) => item.provider === choice.provider);
      if (existing) {
        if (!existing[1].rdns && choice.rdns) {
          choice = { ...existing[1], ...choice, id: existing[0] };
          discovered.set(existing[0], choice);
        } else {
          return;
        }
      } else {
        discovered.set(choice.id, choice);
      }
      providersRef.current = [...discovered.values()];
      setProviders(providersRef.current);

      const metadata = readProviderMetadata();
      const isPreferred = metadata && providerMatchesMetadata(choice, metadata);
      if ((isPreferred || !metadata) && !restoreAttemptsRef.current.has(choice.provider)) {
        restoreAttemptsRef.current.add(choice.provider);
        void restoreFromProvider(choice, true, !isPreferred);
      }
    };
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{
        info: { uuid: string; name: string; rdns?: string; icon: string };
        provider: Eip1193Provider;
      }>).detail;
      if (detail?.provider) add({ id: detail.info.uuid, name: detail.info.name, rdns: detail.info.rdns, icon: detail.info.icon, provider: detail.provider });
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (window.ethereum) add({ id: "legacy-injected", name: window.ethereum.isMetaMask ? "MetaMask" : "Browser wallet", provider: window.ethereum });
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, [restoreFromProvider]);

  useEffect(() => {
    if (!selected) return;
    const accountsChanged = (...args: unknown[]) => {
      const nextAddress = (args[0] as string[])?.[0] as `0x${string}` | undefined;
      if (!nextAddress) {
        clearSession(true, true);
        return;
      }
      setAddress(nextAddress);
      persistProvider(selected);
      publishRevalidation();
    };
    const chainChanged = (...args: unknown[]) => {
      setChainId(String(args[0]).toLowerCase());
      publishRevalidation();
    };
    selected.provider.on?.("accountsChanged", accountsChanged);
    selected.provider.on?.("chainChanged", chainChanged);
    return () => {
      selected.provider.removeListener?.("accountsChanged", accountsChanged);
      selected.provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [clearSession, persistProvider, publishRevalidation, selected]);

  const connect = useCallback(async (choice: InjectedProvider) => {
    setConnecting(true);
    setError(null);
    try {
      const accounts = await choice.provider.request({ method: "eth_requestAccounts" }) as string[];
      const nextAddress = accounts[0] as `0x${string}` | undefined;
      if (!nextAddress) throw new Error("The wallet did not return an account.");
      selectedRef.current = choice;
      setSelected(choice);
      setAddress(nextAddress);
      persistProvider(choice);
      let nextChainId = String(await choice.provider.request({ method: "eth_chainId" })).toLowerCase();
      setChainId(nextChainId);
      if (nextChainId !== BRADBURY_CHAIN_ID) {
        await switchToBradbury(choice.provider);
        nextChainId = String(await choice.provider.request({ method: "eth_chainId" })).toLowerCase();
        setChainId(nextChainId);
      }
      setModalOpen(nextChainId !== BRADBURY_CHAIN_ID);
      publishRevalidation();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setConnecting(false);
    }
  }, [persistProvider, publishRevalidation]);

  const switchNetwork = useCallback(async () => {
    if (!selected) return;
    setConnecting(true);
    setError(null);
    try {
      await switchToBradbury(selected.provider);
      setChainId(String(await selected.provider.request({ method: "eth_chainId" })).toLowerCase());
      setModalOpen(false);
      publishRevalidation();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setConnecting(false);
    }
  }, [publishRevalidation, selected]);

  const client = useMemo(() => address && selected ? createClient({ chain: BRADBURY, account: address, provider: selected.provider }) : null, [address, selected]);
  const value = useMemo<WalletContextValue>(() => ({
    address, chainId, client, error, isConnecting, isModalOpen,
    isOnBradbury: chainId === BRADBURY_CHAIN_ID,
    providers, connect,
    openModal: () => { setError(null); setModalOpen(true); },
    closeModal: () => { if (!isConnecting) setModalOpen(false); },
    switchNetwork,
  }), [address, chainId, client, connect, error, isConnecting, isModalOpen, providers, switchNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used inside WalletProvider");
  return wallet;
}
