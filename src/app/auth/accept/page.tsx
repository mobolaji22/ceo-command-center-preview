import { Suspense } from "react";
import { ConfirmLink } from "../confirm";

export default function Page() {
  return <Suspense><ConfirmLink kind="invitation" /></Suspense>;
}
