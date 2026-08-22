export type ClaimStatus = "Submitted" | "Evidence Review" | "Coverage Analysis" | "Decision Ready" | "Awaiting Documents" | "Approved" | "Partially Approved" | "More Evidence Required" | "Rejected" | "Investigation";
export type Claim = { id:string; claimant:string; coverage:string; amount:number; evidence:string; risk:string; status:ClaimStatus; activity:string };
export const naira = (value:number) => new Intl.NumberFormat("en-NG", { style:"currency", currency:"NGN", maximumFractionDigits:0 }).format(value);
export const claims:Claim[] = [
  {id:"CG-20481",claimant:"Chinedu Okafor",coverage:"Comprehensive Motor",amount:1850000,evidence:"Strong · 87%",risk:"Low",status:"Decision Ready",activity:"18 min ago"},
  {id:"CG-20463",claimant:"Amara Nwosu",coverage:"Motor Third Party",amount:640000,evidence:"Partial · 62%",risk:"Medium",status:"Awaiting Documents",activity:"1 hr ago"},
  {id:"CG-20439",claimant:"David Mensah",coverage:"Comprehensive Motor",amount:3200000,evidence:"Strong · 91%",risk:"Low",status:"Evidence Review",activity:"2 hrs ago"},
  {id:"CG-20422",claimant:"Fatima Bello",coverage:"Comprehensive Motor",amount:980000,evidence:"Verified · 94%",risk:"Low",status:"Approved",activity:"Yesterday"},
  {id:"CG-20405",claimant:"Tunde Adebayo",coverage:"Fleet Motor",amount:4600000,evidence:"Conflicting · 48%",risk:"Elevated",status:"Investigation",activity:"Yesterday"},
];
export const timeline = [
  ["09:12","Claim created","Claimant submitted"], ["09:28","Incident photographs submitted","Claimant submitted"],
  ["10:04","Police accident report added","Official record"], ["11:16","Repair estimate uploaded","Third-party evidence"],
  ["12:42","Policy schedule verified","Official record"], ["14:05","Insurer review added","Insurer supplied"],
];
export const evidence = [
  {title:"Police Accident Report",source:"Lekki Police Division",by:"Sgt. A. Balogun",type:"Official record",relevance:"High",state:"Verified",claim:"CG-20481"},
  {title:"Damage Photographs",source:"Mobile upload · 8 files",by:"Chinedu Okafor",type:"Photographs",relevance:"High",state:"Verified",claim:"CG-20481"},
  {title:"Repair Estimate",source:"Adekunle Auto Works",by:"Ifeanyi Obi",type:"Financial",relevance:"High",state:"Reviewed",claim:"CG-20481"},
  {title:"Witness Statement",source:"Secure web form",by:"Adaeze Eze",type:"Testimony",relevance:"Medium",state:"Pending review",claim:"CG-20439"},
  {title:"Policy Schedule",source:"Anchor Mutual Insurance",by:"Policy operations",type:"Policy",relevance:"High",state:"Verified",claim:"CG-20481"},
  {title:"Medical Invoice",source:"Cedarcrest Hospital",by:"Amara Nwosu",type:"Invoice",relevance:"Medium",state:"Needs attention",claim:"CG-20463"},
];
export const policies = [
  {number:"CGM-883029",holder:"Chinedu Okafor",coverage:"Comprehensive Motor",limit:5000000,deductible:150000,status:"Active",expiry:"18 Mar 2027"},
  {number:"MTP-441820",holder:"Amara Nwosu",coverage:"Motor Third Party",limit:1000000,deductible:50000,status:"Active",expiry:"02 Dec 2026"},
  {number:"CGM-771942",holder:"David Mensah",coverage:"Comprehensive Motor",limit:8500000,deductible:250000,status:"Active",expiry:"09 Jan 2027"},
  {number:"CGM-610773",holder:"Fatima Bello",coverage:"Comprehensive Motor",limit:4000000,deductible:100000,status:"Renewal due",expiry:"28 Aug 2026"},
  {number:"FLT-209401",holder:"Adebayo Logistics",coverage:"Fleet Motor",limit:25000000,deductible:500000,status:"Active",expiry:"14 May 2027"},
];
