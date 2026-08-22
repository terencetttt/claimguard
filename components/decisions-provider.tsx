"use client";
import { createContext,useCallback,useContext,useMemo,useSyncExternalStore } from "react";
import { decisionStorage } from "@/lib/decision-storage";
import type { ClaimDecision } from "@/lib/decision-types";
type Value={decisions:ClaimDecision[];findDecision:(claimId:string)=>ClaimDecision|undefined;saveDecision:(decision:ClaimDecision)=>void};
const Context=createContext<Value|null>(null);const empty:ClaimDecision[]=[];
export function DecisionsProvider({children}:{children:React.ReactNode}){const decisions=useSyncExternalStore(decisionStorage.subscribe,decisionStorage.list,()=>empty);const saveDecision=useCallback((decision:ClaimDecision)=>decisionStorage.save({...decision,updatedAt:new Date().toISOString()}),[]);const value=useMemo<Value>(()=>({decisions,findDecision:(id)=>decisions.find(item=>item.claimId===id),saveDecision}),[decisions,saveDecision]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useDecisions(){const value=useContext(Context);if(!value)throw new Error("useDecisions must be used inside DecisionsProvider");return value}
