import type { DiscussionMessage } from "./discussion-api";

export type DiscussionThreadNode = {
  root: DiscussionMessage;
  replies: DiscussionMessage[];
};

/** Flat messages → roots + descendant replies (for collapsed threads). */
export function buildDiscussionThreads(
  messages: DiscussionMessage[],
): DiscussionThreadNode[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const children = new Map<number, DiscussionMessage[]>();
  const roots: DiscussionMessage[] = [];

  for (const message of messages) {
    const parentId = message.reply_to_message_id;
    if (parentId != null && byId.has(parentId)) {
      const list = children.get(parentId) ?? [];
      list.push(message);
      children.set(parentId, list);
    } else {
      roots.push(message);
    }
  }

  function collectDescendants(id: number): DiscussionMessage[] {
    const direct = children.get(id) ?? [];
    const out: DiscussionMessage[] = [];
    for (const child of direct) {
      out.push(child, ...collectDescendants(child.id));
    }
    return out;
  }

  return roots.map((root) => ({
    root,
    replies: collectDescendants(root.id),
  }));
}

export function countThreadReplies(node: DiscussionThreadNode): number {
  return node.replies.length;
}
