import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';

import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, XCircle, Edit3, Filter,
  MessageSquare, Mail, GitBranch, Users, FileText, 
  LayoutTemplate, Sparkles, AlertTriangle, Check, Trash2, Archive
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AIOutput, Company } from '@/api/entities';
import SendOutputToSection from '@/components/ai/SendOutputToSection';
import AIOutputsArchive from '@/components/ai/AIOutputsArchive';

const CATEGORIES = [
  { value: 'all', label: 'All Outputs' },
  { value: 'message_templates', label: 'Message Templates', icon: MessageSquare },
  { value: 'email_templates', label: 'Email Templates', icon: Mail },
  { value: 'strategies', label: 'Strategies', icon: Sparkles },
  { value: 'prospect_list', label: 'Prospect List', icon: Users },
  { value: 'copies', label: 'Copies', icon: FileText },
  { value: 'blogposts', label: 'Blog Posts', icon: LayoutTemplate },
  { value: 'workflows', label: 'Workflows', icon: GitBranch },
  { value: 'ad_copy', label: 'Ad Copy', icon: FileText },
  { value: 'social_media', label: 'Social Media Posts', icon: MessageSquare },
];




export default function AIOutputs() {
  const { isPt } = useLanguage();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState('review');

  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });
  const companyId = companies[0]?.id;

  const { data: rawOutputs, isLoading: isLoadingOutputs, isError: isOutputsError, refetch } = useQuery({
    queryKey: ['aiOutputs', companyId],
    queryFn: () => AIOutput.filter({ company_id: companyId }),
    enabled: !isLoadingCompanies && !!companyId,
    retry: 1,
  });

  // Backend returns { data: [...], total: N } — extract array safely
  const outputs = Array.isArray(rawOutputs)
    ? rawOutputs.filter(o => o?.type !== 'conversation')
    : Array.isArray(rawOutputs?.data)
      ? rawOutputs.data.filter(o => o?.type !== 'conversation')
      : [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => AIOutput.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aiOutputs'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => AIOutput.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aiOutputs'] }); toast.success('Deleted'); },
  });

  const [editingOutput, setEditingOutput] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [showApplyWarning, setShowApplyWarning] = useState(false);
  const [neverShowWarning, setNeverShowWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const filtered = outputs.filter(o => category === 'all' || o.category === category);
  const pendingCount = outputs.filter(o => (o.status || 'pending') === 'pending').length;

  const handleAction = (id, action) => {
    if (applyToAll) {
      if (!neverShowWarning) {
        setPendingAction({ id, action });
        setShowApplyWarning(true);
        return;
      }
      applyActionToAll(id, action);
    } else {
      applyActionSingle(id, action);
    }
  };

  const applyActionSingle = async (id, action) => {
    updateMutation.mutate({ id, data: { status: action } });
    // The outcome is recorded and fed to the Company Brain's learning loop.
    // (This used to claim "Action will be executed automatically", referring to
    // a Base44-era entity automation that does not exist in this codebase.)
    toast.success(action === 'approved'
      ? (isPt ? 'Aprovado — o cérebro da empresa aprendeu com isso.' : 'Approved — your Company Brain learned from this.')
      : (isPt ? 'Rejeitado — a IA vai evitar esse padrão.' : 'Rejected — the AI will avoid this pattern.'));
  };

  const applyActionToAll = (id, action) => {
    const target = outputs.find(o => o.id === id);
    if (!target) return;
    outputs.filter(o => o.category === target.category || category === 'all')
      .forEach(o => updateMutation.mutate({ id: o.id, data: { status: action } }));
    toast.success(`Applied "${action}" to all ${category === 'all' ? '' : category} outputs.`);
    setPendingAction(null);
    setShowApplyWarning(false);
  };

  const confirmApplyToAll = () => {
    if (pendingAction) applyActionToAll(pendingAction.id, pendingAction.action);
  };

  const startEdit = (output) => {
    setEditingOutput(output);
    setEditContent(output.content);
  };

  const saveEdit = () => {
    updateMutation.mutate({ id: editingOutput.id, data: { content: editContent, status: 'approved' } });
    setEditingOutput(null);
    toast.success('Output edited and approved!');
  };

  // Save the edit but keep the decision open — the user can come back and
  // choose to use it later. The backend keeps the AI's original text.
  const saveEditDraft = () => {
    updateMutation.mutate({
      id: editingOutput.id,
      data: { content: editContent, draft_saved_at: new Date().toISOString() },
    });
    setEditingOutput(null);
    toast.success(isPt ? 'Rascunho salvo' : 'Draft saved');
  };

  const statusColors = {
    pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    approved: 'text-green-400 bg-green-400/10 border-green-400/20',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
  };

  const categoryLabel = CATEGORIES.find(c => c.value === category)?.label || 'All Outputs';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          AI Outputs
        </h1>
        <p className="text-gray-400 mt-1">Review, edit, approve or reject AI-generated content before execution</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="review" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            {isPt ? 'Revisar' : 'Review'}
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px]">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="archive" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff] gap-1.5">
            <Archive size={14} /> {isPt ? 'Arquivo' : 'Archive'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="archive" className="mt-4">
          <AIOutputsArchive />
        </TabsContent>

        <TabsContent value="review" className="mt-4 space-y-6">

      {/* Controls */}
      <div className="flex items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-gray-400 text-sm">Category:</span>
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[220px] border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gray-400 text-sm">{filtered.length} outputs</span>
          <div className="px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs">
            {filtered.filter(o => o.status === 'pending').length} pending review
          </div>
        </div>
      </div>

      {/* Loading state */}
      {(isLoadingCompanies || isLoadingOutputs) && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error state */}
      {isOutputsError && !isLoadingOutputs && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={36} className="text-red-400 mb-3" />
          <p className="text-white font-medium mb-1">{isPt ? 'Erro ao carregar saídas' : 'Failed to load outputs'}</p>
          <p className="text-gray-400 text-sm mb-4">{isPt ? 'Verifique sua conexão e tente novamente.' : 'Check your connection and try again.'}</p>
          <Button onClick={() => refetch()} variant="outline" className="border-white/10 text-white hover:bg-white/5">
            {isPt ? 'Tentar novamente' : 'Retry'}
          </Button>
        </div>
      )}

      {/* Outputs List */}
      <div className="space-y-4">
        {!isLoadingCompanies && !isLoadingOutputs && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl bg-white/5 border border-white/10">
            <Sparkles size={40} className="text-[#38b6ff] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No outputs yet</h3>
            <p className="text-gray-400">AI-generated content saved from the AI Chat will appear here for review and approval.</p>
          </div>
        ) : null}
        {!isLoadingCompanies && !isLoadingOutputs && filtered.map(output => (
            <div key={output.id}
              className={`rounded-2xl border p-5 transition-all duration-200
                ${output.status === 'approved' ? 'bg-green-500/5 border-green-500/20' :
                  output.status === 'rejected' ? 'bg-red-500/5 border-red-500/20' :
                  'bg-white/5 border-white/10'}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{output.title}</span>
                      {output.channel && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">{output.channel}</span>
                      )}
                      {output.count && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff]">{output.count} contacts</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[output.status]}`}>
                        {output.status}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {/* created_at is the column; created_date never existed,
                            so no date was ever shown here. */}
                        {output.created_at || output.created_date
                          ? new Date(output.created_at || output.created_date).toLocaleDateString()
                          : ''}
                      </span>
                      <span className="text-gray-400 text-xs capitalize">
                        {CATEGORIES.find(c => c.value === output.category)?.label}
                      </span>
                    </div>
                  </div>
                </div>
                
                {output.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => startEdit(output)}
                      variant="outline"
                      className="gap-1"
                    >
                      <Edit3 size={14} />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction(output.id, 'rejected')}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAction(output.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 gap-1"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </Button>
                  </div>
                )}

                {/* Approving filed it; this is what puts it in the section it
                    belongs to. Without it an approved output stayed in the archive
                    and never appeared in Ads/Social/Blog, which is what made the
                    flow feel like it had done nothing. */}
                <SendOutputToSection output={output} />
                {output.status !== 'pending' && (
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: output.id, data: { status: 'pending' } })}
                  variant="outline"
                >
                  Undo
                </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => deleteMutation.mutate(output.id)}
                  variant="outline"
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>

              {output.subject && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-gray-400 text-xs">Subject: </span>
                  <span className="text-sm font-medium">{output.subject}</span>
                </div>
              )}

              <div className="px-3 py-3 rounded-xl bg-white/5 border border-white/10">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                  {output.content}
                </pre>
              </div>
            </div>
          ))}
      </div>

      {/* Apply to All Footer */}
      <div className="sticky bottom-0 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div 
            onClick={() => setApplyToAll(!applyToAll)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
              ${applyToAll ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30 hover:border-white/60'}`}
          >
            {applyToAll && <Check size={12} className="text-white" />}
          </div>
          <span className="text-sm font-medium">Apply to all in current category</span>
        </label>
        <p className="text-gray-400 text-xs">
          When enabled, approving or rejecting one output applies to all in the same category
        </p>
      </div>

        </TabsContent>
      </Tabs>

      {/* Apply to All Warning Dialog */}
      <Dialog open={showApplyWarning} onOpenChange={setShowApplyWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-yellow-400" />
              Apply to All Outputs
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-300 text-sm">
              This action will apply to <strong className="text-white">all outputs in the "{categoryLabel}"</strong> category. 
              This cannot be easily undone for approved outputs that trigger automated actions.
            </p>
            <label className="flex items-center gap-3 mt-4 cursor-pointer">
              <div 
                onClick={() => setNeverShowWarning(!neverShowWarning)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                  ${neverShowWarning ? 'bg-[#38b6ff] border-[#38b6ff]' : 'border-white/30'}`}
              >
                {neverShowWarning && <Check size={10} className="text-white" />}
              </div>
              <span className="text-gray-400 text-sm">Never show me this again</span>
            </label>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowApplyWarning(false); setPendingAction(null); }}>
              Cancel
            </Button>
            <Button onClick={confirmApplyToAll} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingOutput} onOpenChange={() => setEditingOutput(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Output: {editingOutput?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px]"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingOutput(null)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={saveEditDraft}
              className="border-[#38b6ff]/40 text-[#38b6ff] hover:bg-[#38b6ff]/10">
              {isPt ? 'Salvar rascunho' : 'Save draft'}
            </Button>
            <Button onClick={saveEdit} className="bg-green-600 hover:bg-green-700 gap-2">
              <CheckCircle2 size={16} />
              Save & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}