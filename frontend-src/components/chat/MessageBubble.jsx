import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Copy, Bot, User, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || 'Function';
  const status = toolCall?.status || 'pending';
  const results = toolCall?.results;
  
  const parsedResults = (() => {
    if (!results) return null;
    try {
      return typeof results === 'string' ? JSON.parse(results) : results;
    } catch {
      return results;
    }
  })();
  
  const isError = results && (
    (typeof results === 'string' && /error|failed/i.test(results)) ||
    (parsedResults?.success === false)
  );
  
  const statusConfig = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10', text: 'Pending' },
    running: { icon: Loader2, color: 'text-[#38b6ff]', bgColor: 'bg-[#38b6ff]/10', text: 'Running...', spin: true },
    in_progress: { icon: Loader2, color: 'text-[#38b6ff]', bgColor: 'bg-[#38b6ff]/10', text: 'Running...', spin: true },
    completed: isError ? 
      { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10', text: 'Failed' } : 
      { icon: CheckCircle2, color: 'text-green-400', bgColor: 'bg-green-400/10', text: 'Success' },
    success: { icon: CheckCircle2, color: 'text-green-400', bgColor: 'bg-green-400/10', text: 'Success' },
    failed: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10', text: 'Failed' },
    error: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10', text: 'Failed' }
  }[status] || { icon: Zap, color: 'text-gray-400', bgColor: 'bg-gray-400/10', text: '' };
  
  const Icon = statusConfig.icon;
  const formattedName = name.replace(/_/g, ' ').replace(/\./g, ' › ');

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 
          transition-all ${statusConfig.bgColor} hover:border-[#38b6ff]/30`}
      >
        <Icon className={`h-4 w-4 ${statusConfig.color} ${statusConfig.spin ? 'animate-spin' : ''}`} />
        <span className="text-white text-sm">{formattedName}</span>
        {statusConfig.text && (
          <span className={`text-xs ${statusConfig.color}`}>• {statusConfig.text}</span>
        )}
        {!statusConfig.spin && (toolCall.arguments_string || results) && (
          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ml-2 
            ${expanded ? 'rotate-90' : ''}`} />
        )}
      </button>
      
      {expanded && !statusConfig.spin && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-white/10 space-y-3">
          {toolCall.arguments_string && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Parameters:</div>
              <pre className="bg-black/30 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
                  } catch {
                    return toolCall.arguments_string;
                  }
                })()}
              </pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Result:</div>
              <pre className="bg-black/30 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-48">
                {typeof parsedResults === 'object' ? 
                  JSON.stringify(parsedResults, null, 2) : parsedResults}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] 
          flex items-center justify-center flex-shrink-0 mt-1">
          <Bot size={16} className="text-white" />
        </div>
      )}
      
      <div className={`max-w-[80%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        {message.content && (
          <div className={`group relative rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white' 
              : 'bg-white/5 border border-white/10'
          }`}>
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="relative">
                <ReactMarkdown 
                  className="text-sm text-white prose prose-invert prose-sm max-w-none
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                    prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2
                    prose-li:my-0.5 prose-code:text-[#38b6ff] prose-code:bg-black/30
                    prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10"
                  components={{
                    code: ({ inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="relative group/code my-3">
                          <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto border border-white/10">
                            <code className={className} {...props}>{children}</code>
                          </pre>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/code:opacity-100 
                              bg-white/10 hover:bg-white/20"
                            onClick={() => {
                              navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                              toast.success('Code copied');
                            }}
                          >
                            <Copy className="h-3.5 w-3.5 text-gray-300" />
                          </Button>
                        </div>
                      ) : (
                        <code className="px-1.5 py-0.5 rounded bg-black/30 text-[#38b6ff] text-xs">
                          {children}
                        </code>
                      );
                    },
                    a: ({ children, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" 
                        className="text-[#38b6ff] hover:underline">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                
                {!isUser && (
                  <button
                    onClick={handleCopy}
                    className="absolute -right-2 -top-2 p-1.5 rounded-lg bg-white/10 
                      opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    {copied ? (
                      <CheckCircle2 size={14} className="text-green-400" />
                    ) : (
                      <Copy size={14} className="text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {message.tool_calls?.length > 0 && (
          <div className="space-y-2 mt-2">
            {message.tool_calls.map((toolCall, idx) => (
              <FunctionDisplay key={idx} toolCall={toolCall} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#38b6ff] to-[#00e7ff] 
          flex items-center justify-center flex-shrink-0 mt-1">
          <User size={16} className="text-white" />
        </div>
      )}
    </div>
  );
}