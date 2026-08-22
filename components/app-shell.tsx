import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
export function AppShell({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle:string}){return <div className="min-h-screen bg-[#F7F9FC] text-[#142033]"><Sidebar/><div className="min-w-0 lg:pl-[260px]"><Topbar title={title} subtitle={subtitle}/><main className="w-full min-w-0 px-5 py-6 md:px-7 md:py-8 xl:px-8 2xl:px-12 2xl:py-10">{children}</main></div></div>}
