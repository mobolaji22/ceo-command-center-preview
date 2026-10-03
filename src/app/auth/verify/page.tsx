import { Suspense } from "react";
import { ConfirmLink } from "../confirm";

export default function Page() {
  return <Suspense><ConfirmLink kind="sign-in" /></Suspense>;
}
