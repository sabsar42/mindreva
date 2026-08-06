import { getMyMindmap } from "@/lib/services/mindmap.service";
import { MindmapScreen } from "./mindmap-screen";

export default async function MindmapPage() {
  // A plain read of the precomputed map — clustering and labeling happen in
  // the background after summarization, never on page load.
  const { nodes, links } = await getMyMindmap();
  return <MindmapScreen nodes={nodes} links={links} />;
}
