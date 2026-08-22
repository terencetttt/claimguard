import assert from "node:assert/strict";
import test from "node:test";
import {finalizeClaimDraft} from "../lib/claim-types.ts";
import {isDateWithinInclusivePeriod,normalizeDateOnly} from "../lib/policy-date.ts";

function draft(){return{id:"draft-test",status:"Draft",createdAt:"2026-08-15T00:00:00.000Z",updatedAt:"2026-08-15T00:00:00.000Z",walletAddress:null,incident:{incidentType:"Collision",incidentDate:"2026-08-15",location:"Lagos",vehicleRegistration:"TEST 1",description:"Test",thirdPartyInvolved:"No"},policy:{policyNumber:"TEST-001",insurer:"Test",coverageType:"Comprehensive Motor",policyStartDate:"2026-01-01",policyEndDate:"2026-12-31",coverageLimit:5000000,deductible:150000,insuredAsset:"Test vehicle"},financialLoss:{repairEstimate:1700000,propertyDamage:100000,medicalExpenses:0,otherExpenses:50000,requestedAmount:1850000,currency:"NGN"},evidence:[],review:{declarationAccepted:true,submittedAt:null}}}

test("submission preserves all policy coverage dates through JSON persistence",()=>{const finalized=finalizeClaimDraft(draft(),"CG-TEST1","2026-08-16T00:00:00.000Z");const persisted=JSON.parse(JSON.stringify(finalized));assert.equal(persisted.incident.incidentDate,"2026-08-15");assert.equal(persisted.policy.policyStartDate,"2026-01-01");assert.equal(persisted.policy.policyEndDate,"2026-12-31");assert.equal(isDateWithinInclusivePeriod(persisted.incident.incidentDate,persisted.policy.policyStartDate,persisted.policy.policyEndDate),true)});
test("legacy claim with missing policy dates is detectable as unavailable",()=>{const legacy=draft();delete legacy.policy.policyStartDate;delete legacy.policy.policyEndDate;assert.equal(normalizeDateOnly(legacy.policy.policyStartDate??""),null);assert.equal(normalizeDateOnly(legacy.policy.policyEndDate??""),null)});
