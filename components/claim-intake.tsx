"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft,ArrowRight,CalendarDays,FileText,MapPin,Paperclip,Save,ShieldCheck,Trash2 } from "lucide-react";
import { ClaimStepper } from "./claim-stepper";
import { useWallet } from "./wallet-provider";
import { useClaims } from "./claims-provider";
import { claimStorage } from "@/lib/claim-storage";
import { submitClaimToBradbury } from "@/lib/claim-guard-chain";
import { useEvidenceFilePersistence } from "./evidence-file-persistence";
import { createClaimDraft, documentedLoss, type ClaimDraft, type ClaimEvidenceRecord, type ClaimStep, type EvidenceType } from "@/lib/claim-types";
import { BRADBURY_LABEL, shortenAddress } from "@/lib/wallet";
import { naira } from "@/lib/data";

const evidenceTypes: EvidenceType[] = ["Police report","Damage photographs","Repair estimate","Medical document","Policy document","Invoice / receipt","Witness statement","Other"];
const stepNames = ["Incident details","Policy information","Financial loss","Evidence","Review and submit"];
type Errors = Record<string,string>;

export function ClaimIntake(){
  const {address}=useWallet();
  return <ClaimIntakeSession key={address?.toLowerCase()??"guest"}/>;
}

function ClaimIntakeSession(){
  useEvidenceFilePersistence();
  const router=useRouter();
  const wallet=useWallet();
  const {submitDraft}=useClaims();
  const scope=wallet.address?.toLowerCase() ?? null;
  const [draft,setDraft]=useState<ClaimDraft>(()=>claimStorage.loadDraft(scope)??createClaimDraft(wallet.address));
  const [step,setStep]=useState<ClaimStep>(0);
  const [errors,setErrors]=useState<Errors>({});
  const [saveState,setSaveState]=useState<"Saved"|"Saving">("Saved");
  const [submitState,setSubmitState]=useState<"idle"|"submitting">("idle");
  const [submitError,setSubmitError]=useState<string>("");
  const loadedScope=useRef<string|null>(scope);

  useEffect(()=>{
    if(!draft||loadedScope.current!==scope)return;
    setSaveState("Saving");
    const timer=window.setTimeout(()=>{claimStorage.saveDraft(scope,{...draft,updatedAt:new Date().toISOString(),walletAddress:wallet.address});setSaveState("Saved");},650);
    return()=>window.clearTimeout(timer);
  },[draft,scope,wallet.address]);

  const update=<K extends keyof ClaimDraft>(section:K,value:ClaimDraft[K])=>setDraft(current=>current?{...current,[section]:value,updatedAt:new Date().toISOString()}:current);
  const saveNow=()=>{if(!draft)return;setSaveState("Saving");claimStorage.saveDraft(scope,{...draft,updatedAt:new Date().toISOString(),walletAddress:wallet.address});setSaveState("Saved")};

  const validate=(target:ClaimStep)=>{
    if(!draft)return false;
    const next:Errors={};
    if(target===0){const x=draft.incident;if(!x.incidentType)next.incidentType="Incident type is required.";if(!x.incidentDate)next.incidentDate="Incident date is required.";if(!x.location.trim())next.location="Location is required.";if(!x.vehicleRegistration.trim()&&["Collision","Theft","Fire damage","Flood damage","Vandalism"].includes(x.incidentType))next.vehicleRegistration="Vehicle registration is required.";if(!x.description.trim())next.description="Incident description is required.";if(!x.thirdPartyInvolved)next.thirdPartyInvolved="Select a third-party involvement option.";}
    if(target===1){const x=draft.policy;if(!x.policyNumber.trim())next.policyNumber="Policy number is required.";if(!x.insurer.trim())next.insurer="Insurer is required.";const insurerWallet=x.insurerWallet?.trim()??"";if(!insurerWallet)next.insurerWallet="Insurer wallet address is required.";else if(!/^0x[a-fA-F0-9]{40}$/.test(insurerWallet))next.insurerWallet="Enter a valid 0x wallet address.";if(!x.coverageType)next.coverageType="Coverage type is required.";if(!x.policyStartDate)next.policyStartDate="Start date is required.";if(!x.policyEndDate)next.policyEndDate="End date is required.";if(x.policyEndDate&&x.policyStartDate&&x.policyEndDate<x.policyStartDate)next.policyEndDate="Policy end date must follow the start date.";if(x.coverageLimit<0)next.coverageLimit="Enter a non-negative coverage limit.";if(x.deductible<0)next.deductible="Enter a non-negative deductible.";if(!x.insuredAsset.trim())next.insuredAsset="Insured asset is required.";}
    if(target===2){const x=draft.financialLoss;(["repairEstimate","propertyDamage","medicalExpenses","otherExpenses","requestedAmount"] as const).forEach(key=>{if(!Number.isFinite(x[key])||x[key]<0)next[key]="Enter a valid non-negative amount."});}
    if(target===4&&!draft.review.declarationAccepted)next.declaration="Accept the declaration before submitting.";
    setErrors(next); return Object.keys(next).length===0;
  };
  const goNext=()=>{if(validate(step))setStep(Math.min(4,step+1) as ClaimStep)};
  const goBack=()=>{setErrors({});setStep(Math.max(0,step-1) as ClaimStep)};
  const submit=async()=>{
    if(!draft||!validate(4))return;

    setSubmitError("");

    if(!wallet.address){
      setSubmitError("Connect your claimant wallet before submitting.");
      wallet.openModal();
      return;
    }

    if(!wallet.isOnBradbury){
      setSubmitError("Switch your wallet to GenLayer Bradbury before submitting.");
      return;
    }

    if(!wallet.client){
      setSubmitError("GenLayer client is not ready. Reconnect your wallet and try again.");
      return;
    }

    const insurerWallet=(draft.policy.insurerWallet??"").trim();

    if(!/^0x[a-fA-F0-9]{40}$/.test(insurerWallet)){
      setSubmitError("Enter a valid insurer wallet address.");
      return;
    }

    const toChainAmount=(value:number)=>{
      const scaled=Math.round(value*100);
      if(!Number.isSafeInteger(scaled)||scaled<0){
        throw new Error("One or more claim amounts cannot be represented safely on-chain.");
      }
      return BigInt(scaled);
    };

    const claimId=claimStorage.generateClaimId();

    setSubmitState("submitting");

    try{
      await submitClaimToBradbury(
        wallet.client,
        wallet.address,
        {
          claimId,
          insurerWallet:insurerWallet as `0x${string}`,
          policyNumber:draft.policy.policyNumber,
          incidentDate:draft.incident.incidentDate,
          policyStartDate:draft.policy.policyStartDate,
          policyEndDate:draft.policy.policyEndDate,
          incidentSummary:draft.incident.description,
          insuredAsset:draft.policy.insuredAsset,
          requestedAmount:toChainAmount(draft.financialLoss.requestedAmount),
          documentedLoss:toChainAmount(documentedLoss(draft)),
          deductible:toChainAmount(draft.policy.deductible),
          coverageLimit:toChainAmount(draft.policy.coverageLimit),

          // Browser-local uploads are not validator-accessible yet.
          // Evidence will be committed later through the HTTPS manifest flow.
          evidenceManifestUri:"",
          evidenceManifestHash:"",
        },
      );

      const claim=submitDraft(
        {...draft,walletAddress:wallet.address},
        claimId,
      );

      claimStorage.clearDraft(scope);
      router.push(`/claims/${claim.id}`);
    }catch(caught){
      setSubmitError(
        caught instanceof Error
          ? caught.message
          : "Claim submission failed. No local submitted record was created.",
      );
    }finally{
      setSubmitState("idle");
    }
  };
  if(!draft)return <div className="panel p-8 text-sm text-[#718094]">Loading claim draftÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦</div>;

  return <div className="page-reveal grid min-w-0 gap-7 xl:grid-cols-[270px_minmax(0,1fr)] 2xl:grid-cols-[290px_minmax(0,1fr)]"><aside className="panel h-fit p-6 xl:sticky xl:top-7 2xl:p-7"><div className="mb-7 border-b border-[#E4EAF1] pb-5"><p className="eyebrow">Claim progress</p><p className="mt-2 text-sm leading-5 text-[#718094]">Complete five evidence-led intake stages.</p></div><ClaimStepper current={step} onSelect={(value)=>{if(value<=step)setStep(value as ClaimStep)}}/><div className="mt-9 rounded-[14px] border border-[#DCE6F1] bg-[#F3F7FC] p-4 text-[12px] leading-5 text-[#62748B]"><div className="mb-2 flex items-center justify-between font-semibold text-[#34516F]"><span className="flex items-center gap-2"><Save size={14}/>Draft protection</span><span className={saveState==="Saving"?"text-[#946513]":"text-[#087B57]"}>{saveState}</span></div>Your progress is saved as a draft for this wallet.</div></aside><div className="min-w-0 space-y-6"><section className="panel overflow-hidden"><StepHeader step={step}/>{step===0&&<IncidentStep draft={draft} update={update} errors={errors}/>} {step===1&&<PolicyStep draft={draft} update={update} errors={errors}/>} {step===2&&<FinancialStep draft={draft} update={update} errors={errors}/>} {step===3&&<EvidenceStep draft={draft} update={update}/>} {step===4&&<ReviewStep draft={draft} update={update} walletAddress={wallet.address} onEdit={value=>setStep(value)} error={errors.declaration}/>}</section>{step<4&&<FollowingStages current={step}/>}{submitError&&<div className="rounded-xl border border-[#F1C5C9] bg-[#FFF5F5] px-4 py-3 text-xs font-medium leading-5 text-[#A14450]">{submitError}</div>}<div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#DDE4ED] pt-6"><button type="button" onClick={saveNow} className="btn-secondary !min-h-[48px]"><Save size={16}/>Save draft</button><div className="flex gap-3"><button type="button" onClick={goBack} className="btn-secondary !min-h-[48px]" disabled={step===0}><ArrowLeft size={16}/>Back</button>{step<4?<button type="button" onClick={goNext} className="btn-primary !min-h-[48px] !px-5">Continue to {stepNames[step+1].replace(" information","").replace(" and submit","")} <ArrowRight size={16}/></button>:<button type="button" onClick={()=>void submit()} disabled={submitState==="submitting"} className="btn-primary !min-h-[48px] !px-5 disabled:cursor-not-allowed disabled:opacity-60">{submitState==="submitting"?"Submitting to Bradbury...":"Submit claim"} <ArrowRight size={16}/></button>}</div></div></div></div>;
}

function StepHeader({step}:{step:ClaimStep}){return <div className="border-b border-[#DDE4ED] bg-[linear-gradient(135deg,#fff,#F8FAFD)] px-7 py-7 2xl:px-9 2xl:py-8"><div className="flex items-center gap-2 text-[#3975CC]"><ShieldCheck size={15}/><p className="eyebrow !text-[#3975CC]">Step {String(step+1).padStart(2,"0")} of 05</p></div><h2 className="mt-3 text-[26px] font-semibold tracking-[-.035em] text-[#132033] 2xl:text-[30px]">{stepNames[step]}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718094]">{["Create a precise first account of the loss event.","Confirm the policy and coverage applying to this loss.","Document each component of the claimed financial loss.","Add and classify the records supporting this claim.","Check the complete claim record before local submission."][step]}</p></div>}
function ErrorText({children}:{children?:string}){return children?<p role="alert" className="mt-2 text-[11px] font-medium text-[#A14450]">{children}</p>:null}
function Field({label,error,children}:{label:string;error?:string;children:React.ReactNode}){return <label className="block"><span className="label">{label}</span>{children}<ErrorText>{error}</ErrorText></label>}

type StepProps={draft:ClaimDraft;update:<K extends keyof ClaimDraft>(section:K,value:ClaimDraft[K])=>void;errors:Errors};
function IncidentStep({draft,update,errors}:StepProps){const x=draft.incident;const set=(value:Partial<typeof x>)=>update("incident",{...x,...value});return <div className="grid gap-x-6 gap-y-7 p-7 md:grid-cols-2 2xl:p-9"><Field label="Incident type" error={errors.incidentType}><select className="field" value={x.incidentType} onChange={e=>set({incidentType:e.target.value})}><option>Collision</option><option>Theft</option><option>Fire damage</option><option>Flood damage</option><option>Vandalism</option></select></Field><Field label="Incident date" error={errors.incidentDate}><div className="relative"><input className="field" type="date" value={x.incidentDate} onChange={e=>set({incidentDate:e.target.value})}/><CalendarDays className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7B899B]" size={17}/></div></Field><Field label="Location" error={errors.location}><div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7B899B]" size={17}/><input className="field !pl-11" value={x.location} onChange={e=>set({location:e.target.value})}/></div></Field><Field label="Vehicle registration" error={errors.vehicleRegistration}><input className="field uppercase" value={x.vehicleRegistration} onChange={e=>set({vehicleRegistration:e.target.value.toUpperCase()})}/></Field><div className="md:col-span-2"><Field label="Incident description" error={errors.description}><textarea className="field min-h-[190px] resize-y !py-4 leading-6" maxLength={1500} value={x.description} onChange={e=>set({description:e.target.value})}/><div className="mt-2 flex justify-between text-[11px] text-[#8996A6]"><span>Include the sequence of events, parties involved, and visible damage.</span><span className="tabular-nums">{x.description.length} / 1,500</span></div></Field></div><fieldset className="md:col-span-2"><legend className="label">Was another party involved?</legend><div className="flex flex-wrap gap-3">{["Yes","No","Not sure"].map(value=><label key={value} className={`flex min-h-[48px] cursor-pointer items-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-medium transition hover:border-[#9DBCF0] ${x.thirdPartyInvolved===value?"border-[#8DB4FF] bg-[#F1F6FF] text-[#245FAF]":"border-[#D6DFEA] bg-white text-[#526177]"}`}><input type="radio" name="party" checked={x.thirdPartyInvolved===value} onChange={()=>set({thirdPartyInvolved:value as ClaimDraft["incident"]["thirdPartyInvolved"]})} className="size-4 accent-[#4D8DFF]"/>{value}</label>)}</div><ErrorText>{errors.thirdPartyInvolved}</ErrorText></fieldset></div>}

function PolicyStep({draft,update,errors}:StepProps){const x=draft.policy;const set=(value:Partial<typeof x>)=>update("policy",{...x,...value});return <div className="p-7 2xl:p-9"><div className="grid gap-x-6 gap-y-7 md:grid-cols-2"><Field label="Policy number" error={errors.policyNumber}><input className="field" value={x.policyNumber} onChange={e=>set({policyNumber:e.target.value})}/></Field><Field label="Insurer" error={errors.insurer}><input className="field" value={x.insurer} onChange={e=>set({insurer:e.target.value})}/></Field><Field label="Insurer wallet address" error={errors.insurerWallet}><input className="field font-mono" placeholder="0x..." value={x.insurerWallet??""} onChange={e=>set({insurerWallet:e.target.value})}/></Field><Field label="Coverage type" error={errors.coverageType}><select className="field" value={x.coverageType} onChange={e=>set({coverageType:e.target.value})}><option>Comprehensive Motor</option><option>Motor Third Party</option><option>Fleet Motor</option></select></Field><Field label="Insured asset / vehicle" error={errors.insuredAsset}><input className="field" value={x.insuredAsset} onChange={e=>set({insuredAsset:e.target.value})}/></Field><Field label="Policy start date" error={errors.policyStartDate}><input className="field" type="date" value={x.policyStartDate} onChange={e=>set({policyStartDate:e.target.value})}/></Field><Field label="Policy end date" error={errors.policyEndDate}><input className="field" type="date" value={x.policyEndDate} onChange={e=>set({policyEndDate:e.target.value})}/></Field><MoneyField label="Coverage limit" value={x.coverageLimit} error={errors.coverageLimit} onChange={value=>set({coverageLimit:value})}/><MoneyField label="Deductible" value={x.deductible} error={errors.deductible} onChange={value=>set({deductible:value})}/></div><div className="mt-8 rounded-[16px] border border-[#DCE6F1] bg-[#F5F8FC] p-5"><p className="eyebrow">Coverage summary</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><Summary label="Coverage" value={x.coverageType}/><Summary label="Policy limit" value={naira(x.coverageLimit)}/><Summary label="Applicable deductible" value={naira(x.deductible)}/></div></div></div>}

function FinancialStep({draft,update,errors}:StepProps){const x=draft.financialLoss;const set=(value:Partial<typeof x>)=>update("financialLoss",{...x,...value});const total=documentedLoss(draft);return <div className="p-7 2xl:p-9"><div className="grid gap-x-6 gap-y-7 md:grid-cols-2"><MoneyField label="Repair estimate" value={x.repairEstimate} error={errors.repairEstimate} onChange={value=>set({repairEstimate:value})}/><MoneyField label="Property damage" value={x.propertyDamage} error={errors.propertyDamage} onChange={value=>set({propertyDamage:value})}/><MoneyField label="Medical expenses" value={x.medicalExpenses} error={errors.medicalExpenses} onChange={value=>set({medicalExpenses:value})}/><MoneyField label="Other expenses" value={x.otherExpenses} error={errors.otherExpenses} onChange={value=>set({otherExpenses:value})}/></div><div className="mt-8 grid gap-5 rounded-[16px] border border-[#DCE6F1] bg-[#F5F8FC] p-6 md:grid-cols-2"><div><p className="eyebrow">Total documented loss</p><p className="mt-3 text-3xl font-semibold tracking-[-.045em] tabular-nums text-[#132033]">{naira(total)}</p><p className="mt-2 text-xs text-[#7B8899]">Calculated from the four entered loss categories.</p></div><MoneyField label="Requested claim amount" value={x.requestedAmount} error={errors.requestedAmount} onChange={value=>set({requestedAmount:value})}/></div></div>}

function MoneyField({label,value,error,onChange}:{label:string;value:number;error?:string;onChange:(value:number)=>void}){return <Field label={label} error={error}><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#718094]">ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¦</span><input className="field !pl-9 tabular-nums" type="number" min="0" step="1000" value={value} onChange={e=>onChange(e.target.value===""?0:Number(e.target.value))}/></div></Field>}

function EvidenceStep({draft,update}:{draft:ClaimDraft;update:<K extends keyof ClaimDraft>(section:K,value:ClaimDraft[K])=>void}){const [file,setFile]=useState<File|null>(null);const [type,setType]=useState<EvidenceType>("Damage photographs");const [title,setTitle]=useState("");const [source,setSource]=useState("Claimant upload");const [description,setDescription]=useState("");const [formError,setFormError]=useState("");const [preview,setPreview]=useState<string|null>(null);const add=()=>{if(!file||!title.trim()||!source.trim()){setFormError("Choose a file and provide a title and source.");return}const item:ClaimEvidenceRecord={id:crypto.randomUUID(),type,filename:file.name,title:title.trim(),description:description.trim(),source:source.trim(),createdAt:new Date().toISOString(),size:file.size,mimeType:file.type||"application/octet-stream",verificationStatus:"Uploaded"};update("evidence",[...draft.evidence,item]);setFile(null);setTitle("");setDescription("");setFormError("")};const replace=(id:string,value:Partial<ClaimEvidenceRecord>)=>update("evidence",draft.evidence.map(item=>item.id===id?{...item,...value}:item));return <div className="p-7 2xl:p-9"><div className="grid gap-5 rounded-[16px] border border-dashed border-[#BFCDE0] bg-[#F8FAFD] p-6 md:grid-cols-2"><Field label="Evidence file"><input className="field file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDF4FF] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#326DCA]" type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/></Field><Field label="Evidence category"><select className="field" value={type} onChange={e=>setType(e.target.value as EvidenceType)}>{evidenceTypes.map(value=><option key={value}>{value}</option>)}</select></Field><Field label="Evidence title"><input className="field" placeholder="e.g. Front passenger-side damage" value={title} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Source"><input className="field" value={source} onChange={e=>setSource(e.target.value)}/></Field><div className="md:col-span-2"><Field label="Description"><textarea className="field min-h-24 resize-y" value={description} onChange={e=>setDescription(e.target.value)}/></Field></div><div className="md:col-span-2 flex items-center justify-between"><ErrorText>{formError}</ErrorText><button type="button" onClick={add} className="btn-primary"><Paperclip size={15}/>Add evidence</button></div></div><div className="mt-7 space-y-3">{draft.evidence.length===0?<div className="rounded-[14px] border border-[#E1E7EF] p-6 text-center"><FileText className="mx-auto text-[#8EA0B5]" size={22}/><p className="mt-3 text-sm font-semibold">No evidence added yet</p><p className="mt-1 text-xs text-[#7B8899]">Add supporting records before review.</p></div>:draft.evidence.map(item=><article key={item.id} className="rounded-[14px] border border-[#E1E7EF] bg-white p-5"><div className="flex flex-wrap items-start gap-4"><span className="grid size-10 place-items-center rounded-xl bg-[#EDF4FF] text-[#326DCA]"><FileText size={17}/></span><div className="min-w-0 flex-1"><p className="font-semibold text-[#172437]">{item.title}</p><p className="mt-1 text-xs text-[#7B8899]">{item.filename} Ãƒâ€šÃ‚Â· {formatBytes(item.size)} Ãƒâ€šÃ‚Â· {new Date(item.createdAt).toLocaleString("en-NG")}</p><div className="mt-3 flex flex-wrap gap-3"><select aria-label={`Classification for ${item.title}`} className="rounded-lg border border-[#D6DFEA] bg-white px-3 py-2 text-xs" value={item.type} onChange={e=>replace(item.id,{type:e.target.value as EvidenceType})}>{evidenceTypes.map(value=><option key={value}>{value}</option>)}</select><span className="rounded-full bg-[#FFF5DE] px-3 py-2 text-[11px] font-semibold text-[#946513]">{item.verificationStatus}</span></div></div><button type="button" onClick={()=>setPreview(preview===item.id?null:item.id)} className="btn-secondary !min-h-9 !px-3">Metadata</button><button type="button" onClick={()=>update("evidence",draft.evidence.filter(value=>value.id!==item.id))} className="grid size-9 place-items-center rounded-lg text-[#A14450] hover:bg-[#FBECEE]" aria-label={`Remove ${item.title}`}><Trash2 size={16}/></button></div>{preview===item.id&&<dl className="mt-4 grid gap-3 border-t border-[#E7ECF2] pt-4 text-xs sm:grid-cols-3"><Summary label="Source" value={item.source}/><Summary label="MIME type" value={item.mimeType}/><Summary label="Description" value={item.description||"No description supplied"}/></dl>}</article>)}</div></div>}

function ReviewStep({draft,update,walletAddress,onEdit,error}:{draft:ClaimDraft;update:<K extends keyof ClaimDraft>(section:K,value:ClaimDraft[K])=>void;walletAddress:string|null;onEdit:(step:ClaimStep)=>void;error?:string}){const total=documentedLoss(draft);return <div className="space-y-5 p-7 2xl:p-9"><ReviewCard title="Incident summary" onEdit={()=>onEdit(0)} rows={[["Type",draft.incident.incidentType],["Date",draft.incident.incidentDate],["Location",draft.incident.location],["Vehicle",draft.incident.vehicleRegistration],["Third party",draft.incident.thirdPartyInvolved]]}/><ReviewCard title="Policy summary" onEdit={()=>onEdit(1)} rows={[["Policy",draft.policy.policyNumber],["Insurer",draft.policy.insurer],["Insurer wallet",draft.policy.insurerWallet||"Not provided"],["Coverage",draft.policy.coverageType],["Insured asset",draft.policy.insuredAsset],["Limit",naira(draft.policy.coverageLimit)]]}/><ReviewCard title="Financial-loss summary" onEdit={()=>onEdit(2)} rows={[["Documented loss",naira(total)],["Requested amount",naira(draft.financialLoss.requestedAmount)],["Currency","Nigerian naira (NGN)"]]}/><ReviewCard title="Evidence summary" onEdit={()=>onEdit(3)} rows={[["Records supplied",String(draft.evidence.length)],["Status",draft.evidence.length?"Uploaded Ãƒâ€šÃ‚Â· unverified":"No evidence supplied"]]}/><div className="grid gap-4 rounded-[16px] border border-[#DCE6F1] bg-[#F5F8FC] p-5 sm:grid-cols-2"><Summary label="Connected wallet" value={walletAddress?shortenAddress(walletAddress):"Not connected"}/><Summary label="Current GenLayer network" value={BRADBURY_LABEL}/></div><label className={`flex cursor-pointer items-start gap-3 rounded-[16px] border p-5 ${draft.review.declarationAccepted?"border-[#8ECDB8] bg-[#F0FAF6]":"border-[#D6DFEA] bg-white"}`}><input type="checkbox" className="mt-0.5 size-4 accent-[#4D8DFF]" checked={draft.review.declarationAccepted} onChange={e=>update("review",{...draft.review,declarationAccepted:e.target.checked})}/><span className="text-sm leading-6 text-[#435168]">I confirm that the information and evidence supplied in this claim are accurate to the best of my knowledge.</span></label><ErrorText>{error}</ErrorText><div className="rounded-xl bg-[#FFF8E8] p-4 text-xs leading-5 text-[#806225]">Submission requests your wallet signature and writes the claim to the live ClaimGuard intelligent contract on GenLayer Bradbury. Browser-only evidence is not committed until it has a validator-accessible HTTPS manifest.</div></div>}

function ReviewCard({title,onEdit,rows}:{title:string;onEdit:()=>void;rows:string[][]}){return <section className="rounded-[16px] border border-[#E1E7EF] p-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><button type="button" onClick={onEdit} className="text-xs font-semibold text-[#326DCA] hover:underline">Edit</button></div><dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(([label,value])=><Summary key={label} label={label} value={value}/>)}</dl></section>}
function Summary({label,value}:{label:string;value:string}){const wallet=useWallet();const displayValue=label==="Current GenLayer network"?(wallet.isOnBradbury?BRADBURY_LABEL:wallet.chainId?`Wrong network (${wallet.chainId})`:"Not connected"):value;return <div><dt className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">{label}</dt><dd className="mt-1.5 text-xs font-semibold text-[#344359]">{displayValue||"ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</dd></div>}
function FollowingStages({current}:{current:ClaimStep}){const items=[{n:"02",t:"Policy",d:"Policy number, coverage, limit, deductible, policyholder and insurer"},{n:"03",t:"Financial loss",d:"Damage estimate, claim amount, third-party, medical and other costs"},{n:"04",t:"Evidence",d:"Police report, photographs, estimates, statements and invoices"},{n:"05",t:"Review",d:"Validate the complete claim record before submission"}].slice(current);return <section className="panel overflow-hidden"><div className="border-b border-[#E1E7EF] px-7 py-5"><h2 className="text-base font-semibold tracking-[-.02em]">Following stages</h2><p className="mt-1 text-xs text-[#7B8899]">Information requested as you progress through the claim</p></div><div className={`grid divide-y divide-[#E4EAF1] md:grid-cols-2 md:divide-x md:divide-y-0 ${items.length>=3?"xl:grid-cols-4":"xl:grid-cols-2"}`}>{items.map(x=><article key={x.n} className="min-h-[160px] p-6"><span className="font-mono text-[11px] font-semibold text-[#4D8DFF]">{x.n}</span><p className="mt-4 text-sm font-semibold">{x.t}</p><p className="mt-2 text-xs leading-5 text-[#748296]">{x.d}</p></article>)}</div></section>}
function formatBytes(bytes:number){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`}
