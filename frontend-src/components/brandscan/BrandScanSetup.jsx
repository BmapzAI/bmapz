import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Building2, Globe, Instagram, Linkedin, Youtube, Target, Users, Mic, TrendingUp } from 'lucide-react';
import { InvokeLLM } from '@/api/integrations';


const fields = [
  { key: 'name', label: 'Nome da Empresa / Marca Pessoal', icon: Building2, placeholder: 'Ex: Graziela Moreno' },
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://seusite.com.br' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: '@seuinstagram' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/in/seuperfil' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'Canal do YouTube' },
  { key: 'industry', label: 'Segmento / Indústria', icon: Target, placeholder: 'Ex: Empreendedorismo, Educação, Varejo...' },
];

const textareaFields = [
  { key: 'description', label: 'Descrição da Empresa / Serviços', icon: Building2, placeholder: 'Descreva o que sua empresa faz, seus produtos e serviços principais...' },
  { key: 'target_audience', label: 'Público-Alvo', icon: Users, placeholder: 'Quem é seu cliente ideal? Faixa etária, interesses, desafios...' },
  { key: 'main_products', label: 'Produtos / Palestras / Serviços Principais', icon: TrendingUp, placeholder: 'Liste seus principais produtos, palestras ou serviços...' },
  { key: 'competitors', label: 'Concorrentes (opcional)', icon: Target, placeholder: 'Liste seus principais concorrentes...' },
  { key: 'tone_of_voice', label: 'Tom de Voz', icon: Mic, placeholder: 'Como você se comunica? Ex: Profissional, Inspirador, Empático...' },
  { key: 'main_goals', label: 'Objetivos Principais', icon: TrendingUp, placeholder: 'O que você deseja alcançar com este Brand Scan?' },
];

export default function BrandScanSetup({ company, onGenerate }) {
  const [formData, setFormData] = useState({
    name: company?.name || '',
    website: company?.website || '',
    instagram: '',
    linkedin: '',
    youtube: '',
    industry: company?.industry || '',
    description: company?.services_description || '',
    target_audience: '',
    main_products: '',
    competitors: '',
    tone_of_voice: '',
    main_goals: '',
  });
  const [autoFilling, setAutoFilling] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleAutoFill = async () => {
    setAutoFilling(true);
    try {
      const prompt = `Research and provide Brand Scan data for this company/brand:
Name: ${formData.name || company?.name || 'Unknown'}
Website: ${formData.website || company?.website || 'Unknown'}
Industry: ${formData.industry || company?.industry || 'Unknown'}
Description: ${formData.description || company?.services_description || ''}

Return a JSON with: description, target_audience, main_products, tone_of_voice, main_goals, industry. 
Keep it professional and in Portuguese (Brazil). Base it on what you know about this type of business.`;

      const result = await InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            target_audience: { type: 'string' },
            main_products: { type: 'string' },
            tone_of_voice: { type: 'string' },
            main_goals: { type: 'string' },
            industry: { type: 'string' },
          }
        }
      });

      setFormData(prev => ({
        ...prev,
        description: result.description || prev.description,
        target_audience: result.target_audience || prev.target_audience,
        main_products: result.main_products || prev.main_products,
        tone_of_voice: result.tone_of_voice || prev.tone_of_voice,
        main_goals: result.main_goals || prev.main_goals,
        industry: result.industry || prev.industry,
      }));
    } finally {
      setAutoFilling(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate(formData);
    setGenerating(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-[#38b6ff]/10 border border-[#38b6ff]/20 rounded-full px-4 py-1.5">
          <Sparkles className="w-4 h-4 text-[#38b6ff]" />
          <span className="text-[#38b6ff] text-sm font-medium">Brand Scan AI</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Configure seu Brand Scan</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Preencha as informações da sua empresa ou deixe a IA pesquisar automaticamente com base no que já temos em seu perfil.
        </p>
      </div>

      {/* Auto-fill button */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-white font-medium">Auto-preenchimento inteligente</p>
          <p className="text-gray-400 text-sm mt-0.5">A IA irá pesquisar e preencher os campos com base nas configurações da sua conta e informações disponíveis na internet.</p>
        </div>
        <Button
          onClick={handleAutoFill}
          disabled={autoFilling}
          className="shrink-0 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white border-0 hover:opacity-90"
        >
          {autoFilling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {autoFilling ? 'Pesquisando...' : 'Auto-preencher'}
        </Button>
      </div>

      {/* Form */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="text-white font-semibold text-lg">Informações da Empresa</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-gray-300 text-sm">{label}</Label>
              <Input
                placeholder={placeholder}
                value={formData[key]}
                onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {textareaFields.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-gray-300 text-sm">{label}</Label>
              <Textarea
                placeholder={placeholder}
                value={formData[key]}
                onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[80px]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={handleGenerate}
          disabled={generating || !formData.name}
          size="lg"
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white border-0 hover:opacity-90 px-10 h-12 text-base"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
          {generating ? 'Gerando Brand Scan...' : 'Gerar Brand Scan Completo'}
        </Button>
      </div>
    </div>
  );
}