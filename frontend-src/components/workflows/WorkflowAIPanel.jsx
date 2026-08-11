import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { toast } from 'sonner';
import { Sparkles, Check, ChevronDown, ChevronUp, Zap, RefreshCw, Mic, MicOff, ImagePlus, X } from 'lucide-react';
import { NODE_TYPES } from './WorkflowCanvas';
import AIContextField from '@/components/ui/AIContextField';
import { InvokeLLM, UploadFile } from '@/api/integrations';

export default function WorkflowAIPanel({ workflow, nodes, connections, company, leads, onApplySuggestion, onApplyAll, onGenerateWorkflow }) {
  const [prompt, setPrompt] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [applied, setApplied] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const buildContext = () => {
    const icp = company?.icp || {};
    const briefing = company?.briefing || {};
    const recentLeads = leads?.slice(0, 10) || [];
    return `
Company: ${company?.name} | Industry: ${company?.industry}
Services: ${company?.services_description || 'N/A'}
Tone: ${briefing.tone_of_voice?.join(', ') || 'professional'}
ICP: ${icp.primary_audience || ''}, pain points: ${icp.pain_points?.join(', ') || ''}
Workflow: "${workflow?.name || 'New'}" (${workflow?.type || 'sales_outreach'})
Nodes: ${nodes.map(n => `${n.name}(${n.type})`).join(' → ')}
Recent leads (${recentLeads.length}): ${recentLeads.map(l => `${l.lead_company_name} - stage: ${l.funnel_stage}`).join(', ')}
`.trim();
  };

  const analyzeWorkflow = async () => {
    if (nodes.length < 2) { toast.error('Add more nodes before analyzing'); return; }
    setAnalyzing(true);
    try {
      const response = await InvokeLLM({
        action: 'workflow_optimize',
        archiveTitle: 'Workflow optimization suggestions',
        prompt: `You are an expert sales automation strategist. Analyze this workflow and provide actionable optimization suggestions.

${buildContext()}

Evaluate: timing between steps, channel mix, message sequencing, conditional logic, and engagement patterns.
Provide 4-6 specific, actionable suggestions with clear implementation steps.

Return JSON array of suggestions with:
- id (string), type ("timing"|"content"|"sequence"|"logic"|"channel"), title (short), description (1 sentence), 
- impact ("high"|"medium"|"low"), implementation (1-2 concrete sentences on what to change), 
- target_nodes (array of node names that should change)`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' }, type: { type: 'string' }, title: { type: 'string' },
                  description: { type: 'string' }, impact: { type: 'string' },
                  implementation: { type: 'string' }, target_nodes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      });
      setSuggestions(response?.suggestions || []);
      setApplied(new Set());
      if (!response?.suggestions?.length) toast.info('No suggestions at this time — workflow looks good!');
    } catch {
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        setUploadingFile(true);
        try {
          const { url: file_url } = await UploadFile({ file });
          // Transcribe via LLM
          const transcription = await InvokeLLM({
            prompt: 'Transcribe this audio recording into a workflow description request. Return only the transcribed text.',
            file_urls: [file_url],
          });
          setPrompt(prev => (prev ? prev + ' ' : '') + (transcription || ''));
          toast.success('Audio transcribed!');
        } catch { toast.error('Transcription failed'); }
        finally { setUploadingFile(false); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingFile(true);
    try {
      const results = await Promise.all(files.map(f => UploadFile({ file: f })));
      const uploaded = results.map((r, i) => ({ url: r.url || r.file_url, name: files[i].name, type: files[i].type }));
      setUploadedFiles(prev => [...prev, ...uploaded]);
      toast.success(`${files.length} file(s) uploaded`);
    } catch { toast.error('Upload failed'); }
    finally { setUploadingFile(false); e.target.value = ''; }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && uploadedFiles.length === 0) return;
    setGenerating(true);
    try {
      const fileUrls = uploadedFiles.map(f => f.url);
      const response = await InvokeLLM({
        action: 'workflow_build',
        archiveTitle: `Workflow build — ${prompt?.slice(0, 60) || 'from file'}`,
        prompt: `You are a workflow automation expert. Build a sales/marketing workflow based on this request: "${prompt || 'based on the provided image/file'}"
${aiContext ? `\nAdditional context from user: ${aiContext}` : ''}
Context: ${buildContext()}

Create a complete, optimized workflow. Use these node types: trigger, send_message, wait, condition, schedule_meeting, end_success, end_failed.
For send_message nodes, set channel to email/whatsapp/linkedin and include realistic content and subject.
Position nodes: trigger at y:50, then vertical spacing of 130px. Branches go left (x:200) and right (x:600).

Return JSON: { name, description, type (sales_outreach|follow_up|nurturing|custom), nodes: [{id, type, name, x, y, channel?, delay_days?, delay_hours?, condition?, content?, subject?, auto_send?}], connections: [{from: {nodeId, port}, to}] }`,
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }, description: { type: 'string' }, type: { type: 'string' },
            nodes: { type: 'array', items: { type: 'object' } },
            connections: { type: 'array', items: { type: 'object' } }
          }
        }
      });

      if (response) {
        const normalizedNodes = (response.nodes || []).map(n => {
          if (['email', 'whatsapp', 'linkedin'].includes(n.type)) return { ...n, channel: n.type, type: 'send_message' };
          return n;
        });
        onGenerateWorkflow({ ...response, nodes: normalizedNodes });
        setPrompt('');
        setUploadedFiles([]);
        toast.success('Workflow generated!');
        // Auto-analyze after generation
        setTimeout(analyzeWorkflow, 800);
      }
    } catch {
      toast.error('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const applySuggestion = (s) => {
    onApplySuggestion(s);
    setApplied(prev => new Set([...prev, s.id]));
    toast.success('Suggestion applied!');
  };

  const applyAll = () => {
    const unapplied = suggestions.filter(s => !applied.has(s.id));
    unapplied.forEach(s => onApplySuggestion(s));
    setApplied(new Set(suggestions.map(s => s.id)));
    onApplyAll(unapplied);
    toast.success(`Applied ${unapplied.length} suggestions!`);
  };

  const impactColor = { high: 'text-green-400 bg-green-400/10', medium: 'text-yellow-400 bg-yellow-400/10', low: 'text-gray-400 bg-white/5' };
  const typeColor = { timing: '#cb6ce6', content: '#38b6ff', sequence: '#f59e0b', logic: '#00e7ff', channel: '#22c55e' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* AI Build Section */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-[#cb6ce6]" />
          <h3 className="text-white text-sm font-semibold">AI Workflow Builder</h3>
        </div>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your workflow... or use mic/image input below"
          className="min-h-[70px] text-sm bg-black/30 border-white/10 text-white mb-2 resize-none" />
        <div className="mb-2">
          <AIContextField
            value={aiContext}
            onChange={setAiContext}
            placeholder="e.g., Focus on enterprise leads, include LinkedIn steps, delay after no reply 3 days, use consultative tone..."
          />
        </div>

        {/* Input controls */}
        <div className="flex items-center gap-1.5 mb-2">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={uploadingFile}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all
              ${isRecording ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'}`}
            title={isRecording ? 'Stop recording' : 'Record audio input'}
          >
            {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
            {isRecording ? 'Stop' : 'Audio'}
          </button>
          <label className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
            <ImagePlus size={12} />
            {uploadingFile ? 'Uploading...' : 'Image/File'}
            <input type="file" multiple accept="image/*,video/*,.pdf" className="hidden" onChange={handleFileUpload} />
          </label>
          {uploadedFiles.length > 0 && (
            <span className="text-xs text-[#38b6ff]">{uploadedFiles.length} file(s) ready</span>
          )}
        </div>

        {/* Uploaded file previews */}
        {uploadedFiles.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="relative group">
                {f.type.startsWith('image/') ? (
                  <img src={f.url} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt={f.name} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-400">📄</div>
                )}
                <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={(!prompt.trim() && uploadedFiles.length === 0) || generating}
            className="flex-1 bg-gradient-to-r from-[#cb6ce6] to-[#38b6ff] gap-1.5 text-sm">
            {generating ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Sparkles size={13} />}
            {generating ? 'Building...' : 'Build with AI'}
          </Button>
          <Button onClick={analyzeWorkflow} disabled={analyzing || nodes.length < 2} variant="outline"
            className="border-white/10 text-white hover:bg-white/5 gap-1.5 text-sm" title="Optimize with AI — analyze performance & get suggestions">
            {analyzing ? <div className="w-3 h-3 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" /> : <RefreshCw size={13} />}
            <span className="text-xs">Optimize</span>
          </Button>
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {suggestions.length > 0 && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-xs">{suggestions.length} suggestions • {applied.size} applied</span>
            {suggestions.some(s => !applied.has(s.id)) && (
              <Button size="sm" onClick={applyAll}
                className="h-6 px-2 text-[10px] bg-[#38b6ff]/20 text-[#38b6ff] border border-[#38b6ff]/30 hover:bg-[#38b6ff]/30">
                Apply All
              </Button>
            )}
          </div>
        )}

        {suggestions.map((s) => {
          const isApplied = applied.has(s.id);
          const isOpen = expanded === s.id;
          return (
            <div key={s.id} className={`rounded-xl border transition-all ${isApplied ? 'border-green-500/30 bg-green-500/5 opacity-70' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              <button className="w-full flex items-start gap-3 p-3 text-left" onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div className="w-1.5 h-full min-h-[20px] rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: typeColor[s.type] || '#38b6ff' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-xs font-medium">{s.title}</span>
                    {s.impact && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactColor[s.impact] || impactColor.low}`}>{s.impact}</span>}
                    {isApplied && <Check size={12} className="text-green-400" />}
                  </div>
                  <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-2">{s.description}</p>
                </div>
                {isOpen ? <ChevronUp size={12} className="text-gray-500 flex-shrink-0 mt-1" /> : <ChevronDown size={12} className="text-gray-500 flex-shrink-0 mt-1" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="p-2 rounded-lg bg-black/20 text-[11px] text-gray-300">
                    <p className="text-gray-500 font-medium mb-0.5">How to implement:</p>
                    {s.implementation}
                  </div>
                  {!isApplied && (
                    <Button size="sm" onClick={() => applySuggestion(s)}
                      className="w-full h-7 text-xs bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1">
                      <Zap size={11} /> Apply This Suggestion
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {suggestions.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2">
              <Sparkles size={18} className="text-gray-500" />
            </div>
            <p className="text-gray-500 text-xs">Use AI to build or analyze your workflow to get optimization suggestions</p>
          </div>
        )}
      </div>
    </div>
  );
}