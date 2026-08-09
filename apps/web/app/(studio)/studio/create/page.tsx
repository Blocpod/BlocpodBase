import type { Metadata } from "next";
import { CreateTokenFlow } from "@/components/create-token-flow";

export const metadata: Metadata = { title: "Create token" };

export default function CreateTokenPage() {
  return <CreateTokenFlow />;
}
