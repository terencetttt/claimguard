import { DecisionWorkspace } from "@/components/decision-workspace";
export default async function Decision({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DecisionWorkspace id={id}/>}
