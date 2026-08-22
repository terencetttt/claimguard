export type FinalDecisionChoice="Approve"|"Partial approval"|"Request more evidence"|"Reject";
export type FinalDecisionStatus="Approved"|"Partially Approved"|"More Evidence Required"|"Rejected";
type DecisionRecord={choice:FinalDecisionChoice|null;recommendedSettlement:number;rationale:string;requiredEvidenceMessage:string;workflowStatus:string;coverage:{netEligibleAmount:number};activities:{type:string}[]};

export function outcomeStatus(choice:FinalDecisionChoice):FinalDecisionStatus{return choice==="Approve"?"Approved":choice==="Partial approval"?"Partially Approved":choice==="Request more evidence"?"More Evidence Required":"Rejected"}
export function isDecisionValid<T extends DecisionRecord>(decision:T):decision is T&{choice:FinalDecisionChoice}{
  if(!decision.choice)return false;
  if(decision.choice==="Approve")return decision.recommendedSettlement>0&&decision.recommendedSettlement<=decision.coverage.netEligibleAmount;
  if(decision.choice==="Partial approval")return decision.recommendedSettlement>0&&decision.recommendedSettlement<=decision.coverage.netEligibleAmount&&Boolean(decision.rationale.trim());
  if(decision.choice==="Request more evidence")return Boolean(decision.requiredEvidenceMessage.trim());
  return Boolean(decision.rationale.trim());
}
export function finalizeDecision<T extends DecisionRecord>(decision:T):T{
  if(!isDecisionValid(decision))return decision;
  return {...decision,recommendedSettlement:["Reject","Request more evidence"].includes(decision.choice)?0:decision.recommendedSettlement,workflowStatus:outcomeStatus(decision.choice)};
}
export function normalizeFinalizedDecision<T extends DecisionRecord>(decision:T):T{
  const wasFinalized=decision.activities.some(item=>item.type==="decision-finalized");
  if(!wasFinalized||!isDecisionValid(decision))return decision;
  const workflowStatus=outcomeStatus(decision.choice);
  return decision.workflowStatus===workflowStatus?decision:{...decision,workflowStatus};
}
