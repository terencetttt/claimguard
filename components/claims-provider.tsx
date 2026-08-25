"use client";
import {createContext,useCallback,useContext,useMemo,useSyncExternalStore} from "react";
import {claimStorage} from "@/lib/claim-storage";
import {finalizeClaimDraft,type ClaimDraft,type FinalizedClaim} from "@/lib/claim-types";
type ClaimsContextValue={localClaims:FinalizedClaim[];submitDraft:(draft:ClaimDraft,claimId?:string)=>FinalizedClaim;findLocalClaim:(id:string)=>FinalizedClaim|undefined};
const ClaimsContext=createContext<ClaimsContextValue|null>(null);const emptyClaims:FinalizedClaim[]=[];
export function ClaimsProvider({children}:{children:React.ReactNode}){const localClaims=useSyncExternalStore(claimStorage.subscribe,claimStorage.listClaims,()=>emptyClaims);const submitDraft=useCallback((draft:ClaimDraft,claimId?:string)=>{const submittedAt=new Date().toISOString();const claim=finalizeClaimDraft(draft,claimId??claimStorage.generateClaimId(),submittedAt);claimStorage.saveClaim(claim);return claim},[]);const value=useMemo<ClaimsContextValue>(()=>({localClaims,submitDraft,findLocalClaim:(id)=>localClaims.find(claim=>claim.id===id)}),[localClaims,submitDraft]);return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>}
export function useClaims(){const context=useContext(ClaimsContext);if(!context)throw new Error("useClaims must be used inside ClaimsProvider");return context}
