import assert from "node:assert/strict";
import test from "node:test";
import {finalizeDecision,normalizeFinalizedDecision} from "../lib/decision-status.ts";

function decision(choice){return{claimId:"CG-TEST",createdAt:"2026-08-21T00:00:00.000Z",updatedAt:"2026-08-21T00:00:00.000Z",workflowStatus:"Decision Ready",choice,recommendedSettlement:["Reject","Request more evidence"].includes(choice)?0:1550000,rationale:choice==="Partial approval"||choice==="Reject"?"Documented rationale":"",internalNotes:"",requiredEvidenceMessage:choice==="Request more evidence"?"Please provide the missing report.":"",evidenceReviews:[],coverage:{policyActive:true,incidentWithinCoveragePeriod:true,policyDatesAvailable:true,requestedAmount:1700000,documentedLoss:1700000,deductible:150000,coverageLimit:5000000,eligibleLoss:1700000,netEligibleAmount:1550000,completedAt:"2026-08-21T00:00:00.000Z"},activities:[]}}

for(const [choice,status] of [["Approve","Approved"],["Partial approval","Partially Approved"],["Request more evidence","More Evidence Required"],["Reject","Rejected"]]){
  test(`${choice} -> ${status}`,()=>assert.equal(finalizeDecision(decision(choice)).workflowStatus,status));
}

test("rehydration repairs a valid finalized legacy decision",()=>{const legacy=decision("Approve");legacy.activities=[{id:"activity-1",type:"decision-finalized",message:"Claim approved",createdAt:"2026-08-21T00:00:00.000Z"}];assert.equal(normalizeFinalizedDecision(legacy).workflowStatus,"Approved")});
test("a prepared but not finalized recommendation remains Decision Ready",()=>assert.equal(normalizeFinalizedDecision(decision("Approve")).workflowStatus,"Decision Ready"));
