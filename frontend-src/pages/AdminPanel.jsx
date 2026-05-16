import { api } from '@/api/apiClient';
import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Shield, Users, CreditCard, Building2, Zap, Search,
  Edit3, Check, X, Plus, Trash2, AlertTriangle, Crown, UserPlus, Settings,
  History, Lock
} from 'lucide-react';
import { PLANS, formatBRL } from '@/lib/plans';
import { Company } from '@/api/entities';

const PLAN_OPTIONS = ['trial', 'starter', 'growth', 'scale', 'enterprise'];
const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'paused'];
const ROLE_OPTIONS = ['owner', 'system_admin', 'company_admin', 'user'];
const ROLE_LABELS = { owner: '👑 Owner', system_admin: '🛡 System Admin', company_admin: '🏢 Company Admin', user: '👤 User' };

// Helper: can the acting user change the target user's role?
const canEditUser = (actingRole, targetRole) => {
  if (actingRole === 'owner') return targetRole !== 'owner'; // owner can change anyone except other owners
  if (actingRole === 'system_admin') return targetRole !== 'owner' && targetRole !== 'system_admin';
  return false;
};

// Log a change to AdminChangeLog (no-op stub — logged server-side)
const logChange = () => Promise.resolve();

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

function EditSubscriptionModal({ subscription, company, onClose, onSave }) {
  const [form, setForm] = useState({
    plan: subscription?.plan || 'trial',
    status: subscription?.status || 'trialing',
    billing_cycle: subscription?.billing_cycle || 'monthly',
    ai_credits_total: subscription?.ai_credits_total ?? 8000,
    ai_credits_used: subscription?.ai_credits_used ?? 0,
    scan_tokens_total: subscription?.scan_tokens_total ?? 0,
    scan_tokens_used: subscription?.scan_tokens_used ?? 0,
    contacts_limit: subscription?.contacts_limit ?? 1500,
    users_limit: subscription?.users_limit ?? 1,
    extra_users: subscription?.extra_users ?? 0,
    company_profiles_limit: subscription?.company_profiles_limit ?? 1,
    extra_company_profiles: subscription?.extra_company_profiles ?? 0,
    price_brl: subscription?.price_brl ?? 0,
    founder_pricing: subscription?.founder_pricing ?? false,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} className="text-[#38b6ff]" />
            {subscription?.id ? `Edit Subscription — ${company?.name}` : `Create Subscription — ${company?.name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Plan</label>
              <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v }))}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p} className="text-white capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Billing Cycle</label>
              <Select value={form.billing_cycle} onValueChange={v => setForm(p => ({ ...p, billing_cycle: v }))}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                  <SelectItem value="annual" className="text-white">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Price (BRL/mo)</label>
              <Input type="number" value={form.price_brl} onChange={e => setForm(p => ({ ...p, price_brl: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">AI Credits Total</label>
              <Input type="number" value={form.ai_credits_total} onChange={e => setForm(p => ({ ...p, ai_credits_total: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">AI Credits Used</label>
              <Input type="number" value={form.ai_credits_used} onChange={e => setForm(p => ({ ...p, ai_credits_used: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Scan Tokens Total</label>
              <Input type="number" value={form.scan_tokens_total} onChange={e => setForm(p => ({ ...p, scan_tokens_total: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Scan Tokens Used</label>
              <Input type="number" value={form.scan_tokens_used} onChange={e => setForm(p => ({ ...p, scan_tokens_used: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Users Limit</label>
              <Input type="number" value={form.users_limit} onChange={e => setForm(p => ({ ...p, users_limit: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Extra Users</label>
              <Input type="number" value={form.extra_users} onChange={e => setForm(p => ({ ...p, extra_users: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contacts Limit</label>
              <Input type="number" value={form.contacts_limit} onChange={e => setForm(p => ({ ...p, contacts_limit: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Company Profiles Limit</label>
              <Input type="number" value={form.company_profiles_limit} onChange={e => setForm(p => ({ ...p, company_profiles_limit: +e.target.value }))}
                className="bg-black/30 border-white/10 text-white h-9" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.founder_pricing} onChange={e => setForm(p => ({ ...p, founder_pricing: e.target.checked }))}
                className="accent-[#38b6ff] w-4 h-4" />
              <span className="text-sm text-gray-300">Founder Pricing</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.cancel_at_period_end} onChange={e => setForm(p => ({ ...p, cancel_at_period_end: e.target.checked }))}
                className="accent-red-500 w-4 h-4" />
              <span className="text-sm text-gray-300">Cancel at Period End</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={() => onSave(subscription?.id, form)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Check size={16} /> Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GrantCreditsModal({ subscription, company, onClose, onSave }) {
  const [credits, setCredits] = useState(1000);
  const [scanTokens, setScanTokens] = useState(0);
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap size={18} className="text-[#38b6ff]" /> Grant Credits — {company?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">AI Credits to Grant</label>
            <Input type="number" value={credits} onChange={e => setCredits(+e.target.value)} className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Scan Tokens to Grant</label>
            <Input type="number" value={scanTokens} onChange={e => setScanTokens(+e.target.value)} className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Note (optional)</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Bonus for early adopter" className="bg-black/30 border-white/10 text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={() => onSave(subscription, credits, scanTokens, note)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Zap size={16} /> Grant
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCompanyModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', industry: '', website: '', subscription_tier: 'basic' });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-[#38b6ff]" /> Create New Company
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Company Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Acme Corp" className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Industry</label>
            <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
              placeholder="Marketing, SaaS, Retail..." className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Website</label>
            <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              placeholder="https://acme.com" className="bg-black/30 border-white/10 text-white" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => onSave(form)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Plus size={16} /> Create Company
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserModal({ companies, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [companyId, setCompanyId] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-[#38b6ff]" /> Invite User to Platform
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email *</label>
            <Input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@company.com" className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Platform Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                <SelectItem value="user" className="text-white">👤 User</SelectItem>
                <SelectItem value="company_admin" className="text-white">🏢 Company Admin</SelectItem>
                <SelectItem value="system_admin" className="text-white">🛡 System Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Assign to Company (optional)</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue placeholder="Select company..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {companies.map(c => <SelectItem key={c.id} value={c.id} className="text-white">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500">An invitation email will be sent to the user.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!email.trim()} onClick={() => onSave(email, role, companyId)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <UserPlus size={16} /> Send Invite
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCompanyModal({ company, onClose, onSave }) {
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
            <Settings size={18} className="text-[#38b6ff]" /> Edit Company — {company?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Company Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Industry</label>
            <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Website</label>
            <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Services Description</label>
            <Input value={form.services_description} onChange={e => setForm(p => ({ ...p, services_description: e.target.value }))}
              className="bg-black/30 border-white/10 text-white" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!form.name.trim()} onClick={() => onSave(company.id, form)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Check size={16} /> Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmModal({ title, message, onClose, onConfirm }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} /> {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-gray-400 text-sm py-2">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SetAccountModal({ user: targetUser, accounts, onClose, onSave }) {
  const [accountId, setAccountId] = useState(targetUser?.account_id || '');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown size={18} className="text-[#f59e0b]" /> Set Account — {targetUser?.full_name || targetUser?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Account</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue placeholder="Select account..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-white">{a.name} <span className="text-gray-500 text-xs">({a.owner_email})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {accountId && (
            <p className="text-xs text-gray-500 font-mono bg-black/30 px-2 py-1 rounded">ID: {accountId}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!accountId} onClick={() => onSave(targetUser.id, accountId)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Check size={16} /> Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignUserToCompanyModal({ users, companies, onClose, onSave }) {
  const [userId, setUserId] = useState('');
  const [companyId, setCompanyId] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-[#38b6ff]" /> Assign User to Company
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">User</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue placeholder="Select user..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {users.map(u => <SelectItem key={u.id} value={u.id} className="text-white">{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Company</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="bg-black/30 border-white/10 text-white h-9"><SelectValue placeholder="Select company..." /></SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-white/10">
                {companies.map(c => <SelectItem key={c.id} value={c.id} className="text-white">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-500">This will update the user's company_id association.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button disabled={!userId || !companyId} onClick={() => onSave(userId, companyId)} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2">
              <Check size={16} /> Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState('');

  // Modal state
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [grantingCredits, setGrantingCredits] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editingUserRole, setEditingUserRole] = useState('user');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [settingAccount, setSettingAccount] = useState(null);

  useEffect(() => {
    api.get('/api/auth/me').then(r => { const u = r.user;
      setUser(u);
      setIsAdmin(u?.role === 'owner' || u?.role === 'system_admin');
    }).catch(() => {});
  }, []);

  const { data: allCompanies = [] } = useQuery({
    queryKey: ['admin_companies'],
    queryFn: () => Company.list(),
    enabled: isAdmin,
  });

  const { data: allSubscriptions = [] } = useQuery({
    queryKey: ['admin_subscriptions'],
    queryFn: () => Subscription.list(),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['admin_users'],
    queryFn: () => User.list(),
    enabled: isAdmin,
  });

  const { data: allPurchases = [] } = useQuery({
    queryKey: ['admin_purchases'],
    queryFn: () => BillingPurchase.list('-created_date', 100),
    enabled: isAdmin,
  });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['admin_accounts'],
    queryFn: () => Account.list(),
    enabled: isAdmin,
  });

  const { data: changeLogs = [] } = useQuery({
    queryKey: ['admin_changelog'],
    queryFn: () => api.get('/api/admin/change-logs').then(r => Array.isArray(r) ? r : []),
    enabled: isAdmin,
  });

  const updateSubMutation = useMutation({
    mutationFn: ({ id, data }) => Subscription.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_subscriptions'] }); toast.success('Subscription updated'); },
  });

  const createSubMutation = useMutation({
    mutationFn: (data) => Subscription.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_subscriptions'] }); toast.success('Subscription created'); },
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data) => Company.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_companies'] }); toast.success('Company created'); setShowCreateCompany(false); },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }) => Company.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_companies'] }); toast.success('Company updated'); setEditingCompany(null); },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id) => Company.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_companies'] }); toast.success('Company deleted'); setDeletingCompany(null); },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => User.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('User updated'); setEditingUser(null); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => User.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_users'] }); toast.success('User removed'); setDeletingUser(null); },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: ({ id, data }) => BillingPurchase.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin_purchases'] }); toast.success('Purchase updated'); },
  });

  const handleSaveSubscription = (id, formData) => {
    const comp = editingSubscription?._company;
    if (id) {
      updateSubMutation.mutate({ id, data: formData });
      logChange(user, 'edit_subscription', 'subscription', id, comp?.name, formData, `Edited subscription for ${comp?.name}`);
    } else {
      createSubMutation.mutate({ ...formData, company_id: editingSubscription.company_id });
      logChange(user, 'edit_subscription', 'subscription', editingSubscription.company_id, comp?.name, formData, `Created subscription for ${comp?.name}`);
    }
    setEditingSubscription(null);
  };

  const handleGrantCredits = async (subscription, credits, scanTokens, note) => {
    if (!subscription?.id) return;
    const comp = allCompanies.find(c => c.id === subscription.company_id);
    const updates = {};
    if (credits > 0) updates.ai_credits_total = (subscription.ai_credits_total || 0) + credits;
    if (scanTokens > 0) updates.scan_tokens_total = (subscription.scan_tokens_total || 0) + scanTokens;
    updateSubMutation.mutate({ id: subscription.id, data: updates });
    await CreditTransaction.create({
      company_id: subscription.company_id,
      subscription_id: subscription.id,
      type: 'bonus',
      credits_delta: credits,
      description: note || 'Admin grant',
    });
    await logChange(user, 'grant_credits', 'company', subscription.company_id, comp?.name,
      { ai_credits: credits, scan_tokens: scanTokens, note },
      `Granted ${credits} AI credits and ${scanTokens} scan tokens to ${comp?.name}`);
    toast.success(`Granted ${credits} credits and ${scanTokens} scan tokens`);
    setGrantingCredits(null);
  };

  const handleInviteUser = async (email, role, companyId) => {
    await api.post('/api/users/invite', { email, role });
    await logChange(user, 'invite_user', 'user', email, email, { role, company_id: companyId }, `Invited ${email} as ${role}`);
    toast.success(`Invitation sent to ${email}`);
    setShowInviteUser(false);
  };

  const handleSetAccount = async (userId, accountId) => {
    const targetUser = allUsers.find(u => u.id === userId);
    const account = allAccounts.find(a => a.id === accountId);
    updateUserMutation.mutate({ id: userId, data: { account_id: accountId } });
    await logChange(user, 'assign_user', 'user', userId, targetUser?.email, { account_id: accountId, account_name: account?.name }, `Set account for ${targetUser?.email} to ${account?.name}`);
    setSettingAccount(null);
    toast.success('Account ID set');
  };

  const handleAssignUser = async (userId, companyId) => {
    const targetUser = allUsers.find(u => u.id === userId);
    const comp = allCompanies.find(c => c.id === companyId);
    updateUserMutation.mutate({ id: userId, data: { company_id: companyId } });
    await logChange(user, 'assign_user', 'user', userId, targetUser?.email, { company_id: companyId, company_name: comp?.name }, `Assigned ${targetUser?.email} to ${comp?.name}`);
    setShowAssignUser(false);
    toast.success('User assigned to company');
  };

  const getCompanyForSub = (sub) => allCompanies.find(c => c.id === sub.company_id);

  const filteredCompanies = allCompanies.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingPurchases = allPurchases.filter(p => p.status === 'pending');

  const statusColor = (s) => ({ active: 'green', trialing: 'blue', past_due: 'yellow', canceled: 'red', paused: 'gray' }[s] || 'gray');
  const planColor = (p) => ({ enterprise: 'purple', scale: 'blue', growth: 'green', starter: 'gray', trial: 'yellow' }[p] || 'gray');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield size={48} className="text-red-400" />
        <h2 className="text-white text-xl font-bold">Platform Admin Access Only</h2>
        <p className="text-gray-400 text-center max-w-sm">Only users with <strong>Owner</strong> or <strong>System Admin</strong> role can access this panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            <Shield size={28} className="text-[#38b6ff]" /> ADMIN PANEL
          </h1>
          <p className="text-gray-400 mt-1">Full platform control — users, companies, subscriptions & billing</p>
        </div>
        <div className="hidden md:flex gap-3">
          {[
            { label: 'Companies', value: allCompanies.length, color: '#38b6ff' },
            { label: 'Users', value: allUsers.length, color: '#cb6ce6' },
            { label: 'Active Subs', value: allSubscriptions.filter(s => s.status === 'active').length, color: '#22c55e' },
            { label: 'Pending', value: pendingPurchases.length, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center">
              <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
              <p className="text-gray-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {pendingPurchases.length > 0 && (
        <div className="rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-[#f59e0b]" />
          <p className="text-[#f59e0b] font-medium">{pendingPurchases.length} purchase(s) pending manual approval</p>
        </div>
      )}

      {/* Search + Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search companies or users..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
        </div>
        <Button onClick={() => setShowCreateCompany(true)}
          className="bg-white/10 hover:bg-white/15 text-white border border-white/10 gap-2 text-sm">
          <Building2 size={15} /> New Company
        </Button>
        <Button onClick={() => setShowInviteUser(true)}
          className="bg-white/10 hover:bg-white/15 text-white border border-white/10 gap-2 text-sm">
          <UserPlus size={15} /> Invite User
        </Button>
        <Button onClick={() => setShowAssignUser(true)}
          className="bg-white/10 hover:bg-white/15 text-white border border-white/10 gap-2 text-sm">
          <Users size={15} /> Assign User
        </Button>
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto gap-1">
          <TabsTrigger value="companies" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Building2 size={14} className="mr-1.5" /> Companies
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <CreditCard size={14} className="mr-1.5" /> Subscriptions
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Users size={14} className="mr-1.5" /> Users & Roles
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <Zap size={14} className="mr-1.5" /> Billing Approvals
            {pendingPurchases.length > 0 && (
              <span className="ml-1.5 w-5 h-5 rounded-full bg-[#f59e0b] text-black text-[10px] font-bold flex items-center justify-center">
                {pendingPurchases.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="changelog" className="data-[state=active]:bg-[#38b6ff]/20 data-[state=active]:text-[#38b6ff]">
            <History size={14} className="mr-1.5" /> Change Log
          </TabsTrigger>
        </TabsList>

        {/* ── COMPANIES ── */}
        <TabsContent value="companies" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCompanies.map(c => {
              const sub = allSubscriptions.find(s => s.company_id === c.id);
              const companyUsers = allUsers.filter(u => u.company_id === c.id);
              return (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{c.name}</p>
                      <p className="text-gray-500 text-xs">{c.industry || '—'}</p>
                    </div>
                    {sub ? <Badge color={planColor(sub.plan)}>{sub.plan}</Badge> : <Badge color="gray">no sub</Badge>}
                  </div>
                  <div className="space-y-1 text-xs text-gray-400">
                    {c.website && <p>🌐 {c.website}</p>}
                    <p>👥 {companyUsers.length} user(s)</p>
                    <p>📅 {new Date(c.created_date).toLocaleDateString()}</p>
                    {sub && (
                      <>
                        <p>💳 <span className={sub.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{sub.status}</span></p>
                        <p>⚡ {Math.max(0, (sub.ai_credits_total || 0) - (sub.ai_credits_used || 0)).toLocaleString()} credits left</p>
                        <p>🔍 {Math.max(0, (sub.scan_tokens_total || 0) - (sub.scan_tokens_used || 0))} scan tokens left</p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    <Button size="sm" variant="outline" onClick={() => setEditingCompany(c)}
                      className="border-white/10 text-white hover:bg-white/5 text-xs gap-1 h-7">
                      <Edit3 size={11} /> Edit
                    </Button>
                    {sub ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditingSubscription({ ...sub, _company: c })}
                          className="border-white/10 text-white hover:bg-white/5 text-xs gap-1 h-7">
                          <CreditCard size={11} /> Sub
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setGrantingCredits({ sub, comp: c })}
                          className="border-[#38b6ff]/20 text-[#38b6ff] hover:bg-[#38b6ff]/10 text-xs gap-1 h-7">
                          <Zap size={11} /> Credits
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingSubscription({ company_id: c.id, _company: c })}
                        className="border-green-500/20 text-green-400 hover:bg-green-500/10 text-xs gap-1 h-7">
                        <Plus size={11} /> Add Sub
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDeletingCompany(c)}
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs gap-1 h-7 ml-auto">
                      <Trash2 size={11} />
                    </Button>
                  </div>
                </div>
              );
            })}
            {filteredCompanies.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-500 rounded-2xl border border-dashed border-white/10">
                <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                <p>No companies found</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── SUBSCRIPTIONS ── */}
        <TabsContent value="subscriptions" className="space-y-3 mt-4">
          <div className="rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Company</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">AI Credits</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Scan Tokens</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSubscriptions.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8">No subscriptions found</td></tr>
                )}
                {allSubscriptions.map(sub => {
                  const comp = getCompanyForSub(sub);
                  const creditsLeft = Math.max(0, (sub.ai_credits_total || 0) - (sub.ai_credits_used || 0));
                  const pct = sub.ai_credits_total > 0 ? Math.round((sub.ai_credits_used / sub.ai_credits_total) * 100) : 0;
                  return (
                    <tr key={sub.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{comp?.name || sub.company_id}</p>
                        <p className="text-gray-500 text-xs">{sub.user_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={planColor(sub.plan)}>{sub.plan}</Badge>
                        {sub.founder_pricing && <span className="ml-1 text-[10px] text-[#f59e0b]">★ Founder</span>}
                      </td>
                      <td className="px-4 py-3"><Badge color={statusColor(sub.status)}>{sub.status}</Badge></td>
                      <td className="px-4 py-3">
                        <p className="text-white text-xs">{creditsLeft.toLocaleString()} left</p>
                        <div className="w-16 h-1 rounded-full bg-white/10 mt-1">
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : '#38b6ff' }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-xs">{(sub.scan_tokens_total || 0) - (sub.scan_tokens_used || 0)} left</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white text-xs">{formatBRL(sub.price_brl || 0)}/mo</p>
                        {sub.billing_cycle === 'annual' && <p className="text-green-400 text-[10px]">Annual</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setGrantingCredits({ sub, comp })}
                            className="h-7 px-2 text-[#38b6ff] hover:bg-[#38b6ff]/10 text-xs gap-1">
                            <Zap size={12} /> Credits
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingSubscription({ ...sub, _company: comp })}
                            className="h-7 px-2 text-gray-300 hover:bg-white/10 text-xs gap-1">
                            <Edit3 size={12} /> Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredCompanies.filter(c => !allSubscriptions.find(s => s.company_id === c.id)).length > 0 && (
            <div className="rounded-xl border border-dashed border-white/20 p-4">
              <p className="text-gray-400 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-400" /> Companies without a subscription:
              </p>
              <div className="flex flex-wrap gap-2">
                {filteredCompanies.filter(c => !allSubscriptions.find(s => s.company_id === c.id)).map(c => (
                  <Button key={c.id} size="sm" variant="outline"
                    className="border-white/10 text-white hover:bg-white/5 gap-1 text-xs"
                    onClick={() => setEditingSubscription({ company_id: c.id, _company: c })}>
                    <Plus size={12} /> {c.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── USERS & ROLES ── */}
        <TabsContent value="users" className="mt-4">
          <div className="rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">User</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Email</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Company</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Role</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Joined</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-500 py-8">No users found</td></tr>
                )}
                {filteredUsers.map(u => {
                  const userCompany = allCompanies.find(c => c.id === u.company_id);
                  return (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#38b6ff]/20 flex items-center justify-center text-[#38b6ff] text-xs font-bold flex-shrink-0">
                            {(u.full_name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-white">{u.full_name || '—'}</span>
                          {u.role === 'admin' && <Crown size={12} className="text-[#f59e0b]" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                         <p>{userCompany?.name || <span className="text-gray-600">—</span>}</p>
                         {u.account_id && <p className="text-[#f59e0b]/60 text-[10px] font-mono truncate max-w-[100px]">{allAccounts.find(a => a.id === u.account_id)?.name || u.account_id}</p>}
                       </td>
                      <td className="px-4 py-3">
                        {editingUser?.id === u.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editingUserRole} onValueChange={setEditingUserRole}>
                              <SelectTrigger className="h-7 w-36 bg-black/30 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="bg-[#1a1a1a] border-white/10">
                                {ROLE_OPTIONS.filter(r => canEditUser(user?.role, r)).map(r =>
                                  <SelectItem key={r} value={r} className="text-white">{ROLE_LABELS[r]}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <button onClick={async () => {
                              updateUserMutation.mutate({ id: u.id, data: { role: editingUserRole } });
                              await logChange(user, 'change_role', 'user', u.id, u.email, { old_role: u.role, new_role: editingUserRole }, `Changed role of ${u.email} from ${u.role} to ${editingUserRole}`);
                            }} className="p-1 rounded hover:bg-green-500/20 text-green-400"><Check size={14} /></button>
                            <button onClick={() => setEditingUser(null)}
                              className="p-1 rounded hover:bg-red-500/20 text-red-400"><X size={14} /></button>
                          </div>
                        ) : (
                          <Badge color={{ owner: 'purple', system_admin: 'yellow', company_admin: 'blue', user: 'gray' }[u.role] || 'gray'}>
                            {ROLE_LABELS[u.role] || u.role || 'user'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.created_date ? new Date(u.created_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditUser(user?.role, u.role) && (
                            <Button size="sm" variant="ghost"
                              onClick={() => { setEditingUser(u); setEditingUserRole(u.role || 'user'); }}
                              className="h-7 px-2 text-gray-300 hover:bg-white/10 text-xs gap-1">
                              <Edit3 size={12} /> Role
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            onClick={() => setSettingAccount(u)}
                            className="h-7 px-2 text-[#f59e0b] hover:bg-[#f59e0b]/10 text-xs gap-1">
                            <Crown size={12} /> Account
                          </Button>
                          {u.role !== 'owner' && (
                            <Button size="sm" variant="ghost" onClick={() => setDeletingUser(u)}
                              className="h-7 px-2 text-red-400 hover:bg-red-500/10 text-xs">
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── BILLING APPROVALS ── */}
        <TabsContent value="billing" className="mt-4 space-y-3">
          <p className="text-gray-400 text-sm">Review and approve or reject pending purchases manually.</p>
          {allPurchases.length === 0 ? (
            <div className="text-center py-12 text-gray-500 rounded-2xl border border-dashed border-white/10">
              <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
              <p>No purchases yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allPurchases.map(purchase => {
                const comp = allCompanies.find(c => c.id === purchase.company_id);
                return (
                  <div key={purchase.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all
                    ${purchase.status === 'pending' ? 'border-[#f59e0b]/30 bg-[#f59e0b]/5' : 'border-white/5 bg-white/3'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        purchase.status === 'paid' ? 'bg-green-400' :
                        purchase.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <div>
                        <p className="text-white text-sm font-medium">{purchase.description || purchase.type}</p>
                        <p className="text-gray-500 text-xs">{comp?.name || purchase.company_id} · {new Date(purchase.created_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white font-medium">{formatBRL(purchase.amount_brl || 0)}</p>
                        <Badge color={purchase.status === 'paid' ? 'green' : purchase.status === 'pending' ? 'yellow' : 'red'}>
                          {purchase.status}
                        </Badge>
                      </div>
                      {purchase.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => updatePurchaseMutation.mutate({ id: purchase.id, data: { status: 'paid' } })}
                            className="h-8 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 gap-1">
                            <Check size={12} /> Approve
                          </Button>
                          <Button size="sm" onClick={() => updatePurchaseMutation.mutate({ id: purchase.id, data: { status: 'failed' } })}
                            className="h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 gap-1">
                            <X size={12} /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── CHANGE LOG ── */}
        <TabsContent value="changelog" className="mt-4">
          <div className="rounded-xl border border-[#38b6ff]/20 bg-[#38b6ff]/5 p-3 mb-4 flex items-center gap-2">
            <Lock size={14} className="text-[#38b6ff]" />
            <p className="text-[#38b6ff] text-xs">This log is read-only and cannot be edited or deleted. It records all administrative actions.</p>
          </div>
          <div className="rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Date & Time</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Performed By</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Action</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Target</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {changeLogs.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-gray-500 py-8">No changes recorded yet</td></tr>
                )}
                {changeLogs.map(log => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.created_date).toLocaleDateString()}<br />
                      <span className="text-gray-600">{new Date(log.created_date).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-xs">{log.performed_by_email}</p>
                      <Badge color={{ owner: 'purple', system_admin: 'yellow', company_admin: 'blue', user: 'gray' }[log.performed_by_role] || 'gray'}>
                        {ROLE_LABELS[log.performed_by_role] || log.performed_by_role || '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300 font-mono">{log.action_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-xs">{log.target_name || log.target_id}</p>
                      <p className="text-gray-600 text-[10px]">{log.target_type}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-xs">{log.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {editingSubscription && (
        <EditSubscriptionModal
          subscription={editingSubscription.id ? editingSubscription : null}
          company={editingSubscription._company}
          onClose={() => setEditingSubscription(null)}
          onSave={handleSaveSubscription}
        />
      )}
      {grantingCredits && (
        <GrantCreditsModal
          subscription={grantingCredits.sub}
          company={grantingCredits.comp}
          onClose={() => setGrantingCredits(null)}
          onSave={handleGrantCredits}
        />
      )}
      {showCreateCompany && (
        <CreateCompanyModal
          onClose={() => setShowCreateCompany(false)}
          onSave={(data) => createCompanyMutation.mutate(data)}
        />
      )}
      {showInviteUser && (
        <InviteUserModal
          companies={allCompanies}
          onClose={() => setShowInviteUser(false)}
          onSave={handleInviteUser}
        />
      )}
      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSave={(id, data) => updateCompanyMutation.mutate({ id, data })}
        />
      )}
      {deletingCompany && (
        <DeleteConfirmModal
          title="Delete Company"
          message={`Are you sure you want to delete "${deletingCompany.name}"? This cannot be undone.`}
          onClose={() => setDeletingCompany(null)}
          onConfirm={() => deleteCompanyMutation.mutate(deletingCompany.id)}
        />
      )}
      {deletingUser && (
        <DeleteConfirmModal
          title="Remove User"
          message={`Are you sure you want to remove "${deletingUser.full_name || deletingUser.email}" from the platform?`}
          onClose={() => setDeletingUser(null)}
          onConfirm={() => deleteUserMutation.mutate(deletingUser.id)}
        />
      )}
      {settingAccount && (
        <SetAccountModal
          user={settingAccount}
          accounts={allAccounts}
          onClose={() => setSettingAccount(null)}
          onSave={handleSetAccount}
        />
      )}
      {showAssignUser && (
        <AssignUserToCompanyModal
          users={allUsers}
          companies={allCompanies}
          onClose={() => setShowAssignUser(false)}
          onSave={handleAssignUser}
        />
      )}
    </div>
  );
}