import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import type { Schema } from "hast-util-sanitize";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";

import { safeMarkdownHref } from "../../lib/markdown-link";

const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []).filter(
      (tag) => tag !== "img" && tag !== "source",
    ),
    "input",
  ],
  attributes: {
    ...defaultSchema.attributes,
    input: [["type", "checkbox"], "checked", ["disabled", true]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
};

function isChecked(value: unknown): boolean {
  return value === true || value === "true";
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const safeHref = safeMarkdownHref(href);
  if (!safeHref) {
    return <span>{children}</span>;
  }
  return (
    <a href={safeHref} rel="noopener noreferrer nofollow" target="_blank">
      {children}
    </a>
  );
}

function ReadOnlyCheckbox({
  type,
  checked,
}: {
  type?: string;
  checked?: boolean | string;
}) {
  if (type !== "checkbox") {
    return null;
  }
  return (
    <input
      type="checkbox"
      checked={isChecked(checked)}
      disabled
      readOnly
      tabIndex={-1}
      className="mr-2 align-middle"
    />
  );
}

const components: Components = {
  a: MarkdownLink,
  img: () => null,
  input: ReadOnlyCheckbox,
  table: ({ children }) => (
    <div
      data-testid="markdown-table-scroll"
      className="my-2 w-full min-w-0 max-w-full overflow-x-auto"
    >
      <table className="w-max min-w-full border-collapse text-left">{children}</table>
    </div>
  ),
  pre: ({ children }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-gray-50 p-3 text-xs">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-gray-300 pl-3 text-label">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
};

type AssistantMarkdownProps = {
  content: string;
};

export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  return (
    <div className="assistant-markdown min-w-0 max-w-full break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
