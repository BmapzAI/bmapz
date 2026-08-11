import { api } from '@/api/apiClient';
import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/components/ui/LanguageContext';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Users, CreditCard, UserPlus, Edit3, Check, X,
  Crown, Zap, Building2, AlertTriangle, Lock, Plus, Sparkles, ArrowRight, Star
} from 'lucide-react';
import { Company, User, Subscription } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

function Badge({ color, children }) {
  const colors = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-[#38b6ff]/20 text-[#38b6ff] border-[#38b6ff]/30',
    purple: 'bg-[#cb6ce6]/20 text-[#cb6ce6] border-[#cb6ce6]/30',
    gray: 'bg-white/10 text-gray-400 border-white/10',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function InviteUserModal({ onClose, onSave }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-[#38b6ff]" /> {t('inviteTeamMember')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('emailAddressLabel')}</label>
            <Input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="colleague@yourcompany.com" className="bg-black/30 border-white/10 text-white" />
          </div>
          <p className="text-xs text-gray-500">{t('inviteDesc')}</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">{t('cancel')}</Button>
            <Button disabled={!email.trim()} onClick={() => onSave(email)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <UserPlus size={14} /> {t('sendInvite')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCompanyInfoModal({ company, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: company?.name || '',
    industry: company?.industry || '',
    website: company?.website || '',
    services_description: company?.services_description || '',
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-[#38b6ff]" /> {t('editCompanyProfile')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('companyNameLabel')}</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('industryLabel')}</label>
            <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('website')}</label>
            <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('servicesDescription')}</label>
            <Input value={form.services_description} onChange={e => setForm(p => ({ ...p, services_description: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">{t('cancel')}</Button>
            <Button onClick={() => onSave(form)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Check size={14} /> {t('save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCompanyModal({ subscription, currentCount, onClose, onCreate }) {
  const { t, isPt } = useLanguage();
  const navigate = useNavigate();
  const limit = subscription?.company_profiles_limit || 1;
  const extraSlots = subscription?.extra_company_profiles || 0;
  const totalAllowed = limit + extraSlots;
  const canAdd = currentCount < totalAllowed;

  const [form, setForm] = useState({ name: '', industry: '', website: '', services_description: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-[#38b6ff]" />
            {canAdd ? t('addCompanyProfile') : t('upgradeToAddMore')}
          </DialogTitle>
        </DialogHeader>

        {canAdd ? (
          <div className="space-y-3 py-2">
            <p className="text-gray-400 text-xs">
              {isPt
                ? <>Você está usando <strong className="text-white">{currentCount}</strong> de <strong className="text-white">{totalAllowed}</strong> perfil{totalAllowed !== 1 ? 's' : ''} de empresa do seu plano.</>
                : <>You're using <strong className="text-white">{currentCount}</strong> of <strong className="text-white">{totalAllowed}</strong> company profile{totalAllowed !== 1 ? 's' : ''} in your plan.</>}
            </p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('companyNameRequired')}</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={isPt ? 'Minha Nova Empresa' : 'My New Company'} className="bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('industryLabel')}</label>
              <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                className="bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('website')}</label>
              <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                className="bg-black/30 border-white/10 text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('servicesDescription')}</label>
              <Input value={form.services_description} onChange={e => setForm(p => ({ ...p, services_description: e.target.value }))}
                className="bg-black/30 border-white/10 text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">{t('cancel')}</Button>
              <Button disabled={!form.name.trim() || saving} onClick={handleCreate}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                <Check size={14} /> {saving ? t('creating') : t('createCompanyBtn')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">
                {isPt
                  ? <>Você atingiu o limite de <strong>{totalAllowed}</strong> perfil{totalAllowed !== 1 ? 's' : ''} de empresa no seu plano <strong className="capitalize">{subscription?.plan}</strong>.</>
                  : <>You've reached your limit of <strong>{totalAllowed}</strong> company profile{totalAllowed !== 1 ? 's' : ''} on your current <strong className="capitalize">{subscription?.plan}</strong> plan.</>}
              </p>
            </div>
            <p className="text-gray-400 text-sm">{isPt ? 'Escolha uma opção para adicionar mais perfis de empresa:' : 'Choose an option to add more company profiles:'}</p>
            <div className="space-y-3">
              <button onClick={() => { onClose(); navigate(createPageUrl('Billing')); }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-[#38b6ff]/30 bg-[#38b6ff]/5 hover:bg-[#38b6ff]/10 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#38b6ff]/20 flex items-center justify-center">
                    <Sparkles size={16} className="text-[#38b6ff]" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{t('upgradeYourPlan')}</p>
                    <p className="text-gray-400 text-xs">{t('upgradeDesc')}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-[#38b6ff] group-hover:translate-x-1 transition-transform" />
              </button>

              <button onClick={() => { onClose(); navigate(createPageUrl('Billing')); }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-[#cb6ce6]/30 bg-[#cb6ce6]/5 hover:bg-[#cb6ce6]/10 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#cb6ce6]/20 flex items-center justify-center">
                    <Plus size={16} className="text-[#cb6ce6]" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">{t('addExtraSlot')}</p>
                    <p className="text-gray-400 text-xs">{t('addExtraSlotDesc')}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-[#cb6ce6] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">{t('close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CompanyAdminPanel() {
  const { t, isPt } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dbUser: user, isLoadingAuth: loading } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingUserRole, setEditingUserRole] = useState(null);
  const [editingRoleValue, setEditingRoleValue] = useState('user');

  const isOwnerOrSysAdmin = user?.role === 'owner' || user?.role === 'system_admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const hasAccess = isCompanyAdmin || isOwnerOrSysAdmin;

  // Fetch company — by company_id on user, or created_by, or (for owner/sysadmin) first company
  const { data: companies = [] } = useQuery({
    queryKey: ['my_companies', user?.email, user?.company_id],
    queryFn: async () => {
      if (user?.company_id) {
        const byId = await Company.filter({ id: user.company_id });
        if (byId.length > 0) return byId;
      }
      const byCreator = await Company.filter({ created_by: user?.email });
      if (byCreator.length > 0) return byCreator;
      if (isOwnerOrSysAdmin) {
        return Company.list();
      }
      return [];
    },
    enabled: !!user,
  });

  const company = companies[0] || null;

  // All companies under the same account (for counting against plan limit)
  const { data: accountCompanies = [] } = useQuery({
    queryKey: ['account_companies', user?.account_id, user?.email],
    queryFn: async () => Company.filter({ created_by: user?.email }),
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ['my_subscription', company?.id],
    queryFn: () => Subscription.list().then(list => list.find(s => s.company_id === company.id)),
    enabled: !!company?.id,
  });

  const { data: companyUsers = [] } = useQuery({
    queryKey: ['company_users', company?.id],
    queryFn: () => User.filter({ company_id: company.id }),
    enabled: !!company?.id,
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data) => Company.update(company.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['my_companies'] }); toast.success(isPt ? 'Perfil da empresa atualizado' : 'Company profile updated'); setEditingCompany(null); },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => User.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['company_users'] }); toast.success(isPt ? 'Função do usuário atualizada' : 'User role updated'); setEditingUserRole(null); },
  });

  const handleInvite = async (email) => {
    await api.post('/api/users/invite', { email, role: 'user' });
    toast.success(isPt ? `Convite enviado para ${email}` : `Invitation sent to ${email}`);
    setShowInvite(false);
  };

  const handleCreateCompany = async (formData) => {
    const newCompany = await Company.create(formData);
    queryClient.invalidateQueries({ queryKey: ['my_companies'] });
    queryClient.invalidateQueries({ queryKey: ['account_companies'] });
    toast.success(isPt ? `Empresa "${formData.name}" criada!` : `Company "${formData.name}" created!`);
    setShowAddCompany(false);
    window.location.reload();
  };

  const creditsLeft = Math.max(0, (subscription?.ai_credits_total || 0) - (subscription?.ai_credits_used || 0));
  const scanLeft = Math.max(0, (subscription?.scan_tokens_total || 0) - (subscription?.scan_tokens_used || 0));
  const creditsPct = subscription?.ai_credits_total > 0
    ? Math.round((subscription.ai_credits_used / subscription.ai_credits_total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#38b6ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock size={48} className="text-red-400" />
        <h2 className="text-white text-xl font-bold">{t('companyAdminOnly')}</h2>
        <p className="text-gray-400 text-center max-w-sm">{t('companyAdminOnlyDesc')}</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 size={48} className="text-gray-600" />
        <h2 className="text-white text-xl font-bold">{t('noCompanyFound')}</h2>
        <p className="text-gray-400">{t('noCompanyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            <Settings size={24} className="text-[#38b6ff]" /> {t('companyAdmin').toUpperCase()}
          </h1>
          <p className="text-gray-400 mt-1">{t('manageCompany')}</p>
        </div>
        <div className="flex gap-3">
          {(subscription?.company_profiles_limit || 1) > 1 || (subscription?.extra_company_profiles || 0) > 0 || isOwnerOrSysAdmin ? (
            <Button onClick={() => setShowAddCompany(true)}
              variant="outline"
              className="border-[#cb6ce6]/40 text-[#cb6ce6] hover:bg-[#cb6ce6]/10 gap-2 text-sm">
              <Plus size={15} /> {t('addCompanyBtn')}
            </Button>
          ) : null}
          <Button onClick={() => setShowInvite(true)}
            className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2 text-sm">
            <UserPlus size={15} /> {t('inviteMember')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Building2 size={14} className="mr-1.5" /> {t('company')}
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Users size={14} className="mr-1.5" /> {isPt ? 'Equipe' : 'Team'} ({companyUsers.length})
          </TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <CreditCard size={14} className="mr-1.5" /> {isPt ? 'Assinatura' : 'Subscription'}
          </TabsTrigger>
        </TabsList>

        {/* ── COMPANY OVERVIEW ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white text-xl font-bold">{company.name}</h2>
                <p className="text-gray-400 text-sm">{company.industry || (isPt ? 'Setor não definido' : 'Industry not set')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingCompany(company)}
                className="border-white/10 text-white hover:bg-white/5 gap-1">
                <Edit3 size={14} /> {t('editProfileBtn')}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">{t('website')}</p>
                <p className="text-white">{company.website || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">{t('createdLabel')}</p>
                <p className="text-white">{new Date(company.created_date).toLocaleDateString()}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-gray-500 text-xs mb-1">{t('servicesDescription')}</p>
                <p className="text-white">{company.services_description || '—'}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('teamMembersTab'), value: companyUsers.length, max: subscription?.users_limit || '—', color: '#38b6ff' },
              { label: t('aiCreditsLeft'), value: creditsLeft.toLocaleString(), color: creditsPct > 80 ? '#ef4444' : '#22c55e' },
              { label: t('scanTokensLeft'), value: scanLeft, color: '#cb6ce6' },
              { label: t('planLabel'), value: subscription?.plan || 'trial', color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
                {s.max && <p className="text-gray-600 text-[10px]">of {s.max}</p>}
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── TEAM ── */}
        <TabsContent value="team" className="mt-4">
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <p className="text-white font-medium text-sm">{t('teamMembersTab')}</p>
              <p className="text-gray-500 text-xs">
                {companyUsers.length} / {subscription?.users_limit || '—'} {t('seatsLabel')}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">{t('memberCol')}</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">{t('email')}</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">{t('role')}</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">{t('joinedCol')}</th>
                </tr>
              </thead>
              <tbody>
                {companyUsers.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-500 py-8">{t('noTeamMembers')}</td></tr>
                )}
                {companyUsers.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#38b6ff]/20 flex items-center justify-center text-[#38b6ff] text-xs font-bold flex-shrink-0">
                          {(u.full_name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-white">{u.full_name || '—'}</span>
                        {u.role === 'company_admin' && <Crown size={12} className="text-[#f59e0b]" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      {editingUserRole === u.id ? (
                        <div className="flex items-center gap-1">
                          <Select value={editingRoleValue} onValueChange={setEditingRoleValue}>
                            <SelectTrigger className="h-7 w-28 bg-black/30 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-white/10">
                              <SelectItem value="user" className="text-white">👤 User</SelectItem>
                              <SelectItem value="company_admin" className="text-white">🏢 Company Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <button onClick={() => updateUserMutation.mutate({ id: u.id, data: { role: editingRoleValue } })}
                            className="p-1 rounded hover:bg-green-500/20 text-green-400"><Check size={14} /></button>
                          <button onClick={() => setEditingUserRole(null)}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge color={{ company_admin: 'yellow', user: 'gray' }[u.role] || 'gray'}>{u.role || 'user'}</Badge>
                          {u.email !== user?.email && (
                            <button onClick={() => { setEditingUserRole(u.id); setEditingRoleValue(u.role || 'user'); }}
                              className="text-gray-600 hover:text-gray-300 transition-colors">
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.created_date ? new Date(u.created_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── SUBSCRIPTION (Read-only view) ── */}
        <TabsContent value="subscription" className="mt-4 space-y-4">
          {!subscription ? (
            <div className="text-center py-12 text-gray-500 rounded-2xl border border-dashed border-white/10">
              <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
              <p>{t('noSubscription')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">{t('currentPlan')}</p>
                    <p className="text-white text-2xl font-bold capitalize">{subscription.plan}</p>
                  </div>
                  <Badge color={{ active: 'green', trialing: 'blue', past_due: 'yellow', canceled: 'red' }[subscription.status] || 'gray'}>
                    {subscription.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{t('billingCycle')}</p>
                    <p className="text-white capitalize">{subscription.billing_cycle || 'monthly'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{t('priceLabel')}</p>
                    <p className="text-white">R$ {subscription.price_brl || 0}/mo</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{t('usersLimitLabel')}</p>
                    <p className="text-white">{subscription.users_limit || 1} {t('seatsLabel')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{t('contactsLimitLabel')}</p>
                    <p className="text-white">{(subscription.contacts_limit || 0).toLocaleString()}</p>
                  </div>
                  {subscription.founder_pricing && (
                    <div>
                      <p className="text-[#f59e0b] text-xs font-medium">★ {t('founderPricing')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Credits Usage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} className="text-[#38b6ff]" />
                    <p className="text-white font-medium text-sm">{t('aiCredits')}</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{creditsLeft.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs mb-2">{isPt ? 'de' : 'of'} {(subscription.ai_credits_total || 0).toLocaleString()} total</p>
                  <div className="w-full h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${creditsPct}%`, background: creditsPct > 80 ? '#ef4444' : '#38b6ff' }} />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{creditsPct}{t('pctUsed')}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-[#cb6ce6]" />
                    <p className="text-white font-medium text-sm">{t('brandScanTokens')}</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{scanLeft}</p>
                  <p className="text-gray-500 text-xs mb-2">{isPt ? 'de' : 'of'} {subscription.scan_tokens_total || 0} total</p>
                  <div className="w-full h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-[#cb6ce6] transition-all"
                      style={{ width: subscription.scan_tokens_total > 0 ? `${Math.round((subscription.scan_tokens_used / subscription.scan_tokens_total) * 100)}%` : '0%' }} />
                  </div>
                </div>
              </div>

              {/* Upsell path: this tab is where an admin discovers they are
                  running low, so give them somewhere to go from here. */}
              <div className="rounded-2xl border border-[#38b6ff]/25 bg-gradient-to-br from-[#3572b9]/10 to-[#cb6ce6]/10 p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-white font-semibold">
                    {isPt ? 'Precisa de mais capacidade?' : 'Need more capacity?'}
                  </p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {isPt
                      ? 'Compare os planos, ou compre créditos, scans e usuários extras.'
                      : 'Compare plans, or buy extra credits, scans and users.'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => navigate(createPageUrl('Pricing'))}
                    className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
                    <Star size={15} /> {isPt ? 'Ver planos' : 'View plans'}
                  </Button>
                  <Button variant="outline" onClick={() => navigate(createPageUrl('Billing'))}
                    className="border-white/15 text-white hover:bg-white/5 gap-2">
                    <CreditCard size={15} /> {isPt ? 'Cobrança e add-ons' : 'Billing & add-ons'}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-[#38b6ff]/20 bg-[#38b6ff]/5 p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-[#38b6ff] flex-shrink-0 mt-0.5" />
                <p className="text-[#38b6ff] text-sm">{t('billingInfo')}</p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} onSave={handleInvite} />}
      {showAddCompany && (
        <AddCompanyModal
          subscription={subscription}
          currentCount={accountCompanies.length || companies.length}
          onClose={() => setShowAddCompany(false)}
          onCreate={handleCreateCompany}
        />
      )}
      {editingCompany && (
        <EditCompanyInfoModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSave={(data) => updateCompanyMutation.mutate(data)}
        />
      )}
    </div>
  );
}