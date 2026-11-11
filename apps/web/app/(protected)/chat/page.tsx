import { getMyPastSelf } from "@/lib/services/past-self.service";
import { PastSelfScreen } from "./past-self-screen";

export default async function PastSelfPage() {
  const years = await getMyPastSelf();
  return <PastSelfScreen years={years} />;
}
