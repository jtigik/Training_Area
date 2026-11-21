import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders teacher-authored Markdown (sections, statements). react-markdown does
 * not render raw HTML, so content cannot inject scripts.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 leading-relaxed",
        "[&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:font-semibold",
        "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-formula [&_code]:text-sm",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-info [&_blockquote]:bg-info-subtle [&_blockquote]:p-3 [&_blockquote]:text-info-subtle-foreground",
        "[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_img]:max-w-full [&_img]:rounded-md [&_img]:border",
        "[&_a]:text-primary [&_a]:underline",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
