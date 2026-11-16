import { Suspense } from "react";
import { Writer } from "@/components/writer";

export const metadata = { title: "Writer · Bible Quest" };

export default function WritePage() {
  return (
    <Suspense fallback={null}>
      <Writer />
    </Suspense>
  );
}
