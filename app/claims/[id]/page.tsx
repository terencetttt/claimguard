import { ClaimDetailClient } from "@/components/claim-detail-client";
export default async function ClaimDetail({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ClaimDetailClient id={id}/>}
