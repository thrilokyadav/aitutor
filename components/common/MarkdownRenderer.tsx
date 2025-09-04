import React, { useCallback, useMemo } from 'react';
import { marked } from 'marked';
import { CopyIcon } from '../icons/CopyIcon';
import { CheckIcon } from '../icons/CheckIcon';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const [copied, setCopied] = React.useState(false);

  const sanitizedHtml = useMemo(() => marked.parse(content || ''), [content]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <div className={`relative group pb-8`}>
       <div 
        className={`prose prose-invert max-w-none prose-p:my-2 prose-strong:text-slate-100 prose-h2:text-[rgb(var(--color-accent))] ${className}`} 
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
      />
      <div className="absolute bottom-0 right-0">
        <button 
          onClick={handleCopy}
          className="p-1.5 bg-[rgb(var(--color-card))] border border-[rgb(var(--color-border))] rounded-md text-[rgb(var(--color-text-secondary))] opacity-0 group-hover:opacity-100 transition-all hover:text-white hover:border-[rgb(var(--color-primary))]"
          aria-label="Copy to clipboard"
        >
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default MarkdownRenderer;