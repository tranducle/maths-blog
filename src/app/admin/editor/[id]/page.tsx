import { notFound } from "next/navigation";
import { getById } from "@/db/queries";
import { PostEditor } from "@/components/post-editor";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditPostPage({ params }: { params: Params }) {
  const { id } = await params;
  const post = await getById(id);
  if (!post) notFound();
  return <PostEditor initial={post} />;
}
