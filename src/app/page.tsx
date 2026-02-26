import { redirect } from "next/navigation";

const DEFAULT_INDEX = "agent-traces-semantic";

export default function Home() {
  redirect(`/index/${encodeURIComponent(DEFAULT_INDEX)}`);
}
