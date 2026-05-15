import React, { useState } from 'react';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { Building2, User, Mail, Phone, Globe, Linkedin, Upload, FileSpreadsheet, Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { UploadFile } from '@/api/integrations';
import { Company, Lead } from '@/api/entities';

export default function AddLeadForm({ onClose, stages }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [importMode, setImportMode] = useState(false);
  const [formData, setFormData] = useState({
    lead_company_name: '',
    lead_name: '',
    role: '',
    is_decision_maker: false,
    email: '',
    phone: '',
    company_website: '',
    linkedin_profile: '',
    company_linkedin: '',
    company_instagram: '',
    company_facebook: '',
    company_tiktok: '',
    funnel_stage: 'awareness',
    estimated_value: '',
    notes: '',
    source: 'manual',
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });

  const company = companies[0];

  const createLeadMutation = useMutation({
    mutationFn: (data) => Lead.create({
      ...data,
      company_id: company?.id,
      estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead added successfully');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to add lead');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.lead_company_name) {
      toast.error('Company name is required');
      return;
    }
    createLeadMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file_url } = await UploadFile({ file });
      
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lead_company_name: { type: 'string' },
              lead_name: { type: 'string' },
              role: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              company_website: { type: 'string' },
              linkedin_profile: { type: 'string' },
            },
          },
        },
      });

      if (result.status === 'success' && result.output) {
        const leads = result.output.map(lead => ({
          ...lead,
          company_id: company?.id,
          funnel_stage: 'awareness',
          source: 'csv',
        }));
        
        await Lead.bulkCreate(leads);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        toast.success(`${leads.length} leads imported successfully`);
        onClose();
      } else {
        toast.error(result.details || 'Failed to parse file');
      }
    } catch (error) {
      toast.error('Failed to import leads');
    }
  };

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 mb-6 p-1 rounded-xl bg-black/30">
        <button
          onClick={() => setImportMode(false)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all
            ${!importMode ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'}`}
        >
          <User size={18} />
          Manual Entry
        </button>
        <button
          onClick={() => setImportMode(true)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all
            ${importMode ? 'bg-[#38b6ff]/20 text-[#38b6ff]' : 'text-gray-400 hover:text-white'}`}
        >
          <FileSpreadsheet size={18} />
          Import CSV/XLS
        </button>
      </div>

      {importMode ? (
        <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#38b6ff]/20 flex items-center justify-center mx-auto mb-4">
            <Upload size={28} className="text-[#38b6ff]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Upload Lead List</h3>
          <p className="text-gray-400 text-sm mb-4">
            Upload a CSV or XLS file with your leads. Include columns for company name, contact name, email, phone, etc.
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] cursor-pointer">
              <Upload size={18} className="mr-2" />
              Choose File
            </Button>
          </label>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-gray-400 mb-1.5 block">Company Name *</Label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.lead_company_name}
                  onChange={(e) => handleChange('lead_company_name', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="Enter company name"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Contact Name</Label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.lead_name}
                  onChange={(e) => handleChange('lead_name', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="Contact person"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Role</Label>
              <Input
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="bg-black/30 border-white/10 text-white"
                placeholder="e.g., Marketing Director"
              />
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-yellow-400" />
                <div>
                  <Label className="text-white font-medium">Decision Maker</Label>
                  <p className="text-xs text-gray-400">Is this contact the main decision maker?</p>
                </div>
              </div>
              <Switch
                checked={formData.is_decision_maker}
                onCheckedChange={(checked) => handleChange('is_decision_maker', checked)}
              />
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Email</Label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="email@company.com"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Phone/WhatsApp</Label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Website</Label>
              <div className="relative">
                <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.company_website}
                  onChange={(e) => handleChange('company_website', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="https://company.com"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">LinkedIn Profile</Label>
              <div className="relative">
                <Linkedin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.linkedin_profile}
                  onChange={(e) => handleChange('linkedin_profile', e.target.value)}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="LinkedIn URL"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Funnel Stage</Label>
              <Select 
                value={formData.funnel_stage} 
                onValueChange={(value) => handleChange('funnel_stage', value)}
              >
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id} className="text-white hover:bg-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-400 mb-1.5 block">Estimated Value ($)</Label>
              <Input
                type="number"
                value={formData.estimated_value}
                onChange={(e) => handleChange('estimated_value', e.target.value)}
                className="bg-black/30 border-white/10 text-white"
                placeholder="10000"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-gray-400 mb-1.5 block">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="bg-black/30 border-white/10 text-white min-h-[80px]"
                placeholder="Additional notes about this lead..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-white/10 text-white hover:bg-white/5">
              {t('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={createLeadMutation.isPending}
              className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
            >
              {createLeadMutation.isPending ? 'Adding...' : t('addNewLead')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
