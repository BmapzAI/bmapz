import { api } from '@/api/apiClient';
import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, FileSearch, Plus, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/ui/LanguageContext';
import BrandScanSetup from '@/components/brandscan/BrandScanSetup';
import BrandScanReport from '@/components/brandscan/BrandScanReport';
import { toast } from 'sonner';
import { Company } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';

const MAX_VERSIONS = 6;

export default function BrandScan() {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const [activeScanId, setActiveScanId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.user),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
    enabled: !!user,
  });

  const company = companies[0] || null;

  const { data: scans = [] } = useQuery({
    queryKey: ['brandscans'],
    queryFn: () => BrandScan.list('-created_date', 20),
    enabled: !!user,
  });

  // Auto-select latest complete scan on load
  useEffect(() => {
    if (!activeScanId && scans.length > 0) {
      const latest = scans.find(s => s.status === 'complete');
      if (latest) setActiveScanId(latest.id);
    }
  }, [scans]);

  const activeScan = scans.find(s => s.id === activeScanId);
  const completedScans = scans.filter(s => s.status === 'complete');

  const deleteScan = async (id, e) => {
    e.stopPropagation();
    await BrandScan.delete(id);
    if (activeScanId === id) setActiveScanId(null);
    queryClient.invalidateQueries({ queryKey: ['brandscans'] });
    toast.success(language === 'pt' ? 'Scan removido' : 'Scan deleted');
  };

  const handleGenerate = async (formData) => {
    // Enforce 6-version limit: delete oldest if needed
    if (completedScans.length >= MAX_VERSIONS) {
      const oldest = [...completedScans].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      if (oldest) {
        await BrandScan.delete(oldest.id);
      }
    }

    setGenerating(true);
    setShowSetup(false);
    try {
      const scan = await BrandScan.create({
        company_id: company?.id || 'default',
        title: `Brand Scan — ${formData.name}`,
        status: 'generating',
        company_data: formData,
      });

      setActiveScanId(scan.id);

      const prompt = `You are an expert in digital marketing and branding. Generate a complete and professional Brand Scan for the following company/personal brand. Respond in ${language === 'pt' ? 'Brazilian Portuguese' : 'English'}.

COMPANY DATA:
- Name: ${formData.name}
- Website: ${formData.website || 'Not provided'}
- Instagram: ${formData.instagram || 'Not provided'}
- LinkedIn: ${formData.linkedin || 'Not provided'}
- YouTube: ${formData.youtube || 'Not provided'}
- Industry/Segment: ${formData.industry || 'Not provided'}
- Description: ${formData.description}
- Target Audience: ${formData.target_audience}
- Main Products/Services: ${formData.main_products}
- Competitors: ${formData.competitors || 'Not provided'}
- Tone of Voice: ${formData.tone_of_voice}
- Main Goals: ${formData.main_goals}

Generate a complete JSON report specifically tailored to this company, not generic. Include all sections with rich, actionable insights.

JSON structure:
{
  "overview": "3-4 paragraph strategic overview of the brand's digital presence, current positioning, and key opportunities",
  "instagram_metrics": {
    "followers": "estimate or 'To be defined'",
    "audience": "audience description",
    "engagement": "estimated rate",
    "growth": "growth level",
    "frequency": "recommended posting frequency",
    "interests": [{"category": "Business & Careers", "percentage": 69}]
  },
  "linkedin_metrics": {
    "followers": "estimate",
    "posts_30d": "recommended: X",
    "articles_30d": "recommended: Y",
    "avg_engagement": "estimated %",
    "top_themes": ["theme1", "theme2", "theme3"]
  },
  "sentiment_analysis": {"positive": 54, "neutral": 43, "negative": 3},
  "content_formats": {"reels": 50, "carousel": 25, "image": 23, "video": 2},
  "seo_keywords": [
    {"keyword": "relevant keyword", "volume": "10,000", "cpc": "$2.00", "relevance": "High"}
  ],
  "color_psychology": {
    "description": "Color psychology explanation for this brand",
    "colors": [
      {"name": "Primary Color", "hex": "#hexcode", "description": "explanation"},
      {"name": "Secondary Color", "hex": "#hexcode", "description": "explanation"},
      {"name": "Accent Color", "hex": "#hexcode", "description": "explanation"}
    ]
  },
  "buyer_personas": [
    {
      "name": "Persona Name",
      "role": "Role/Position",
      "age": "35",
      "location": "City, Country",
      "tone": "preferred communication tone",
      "challenges": "main challenges",
      "channels": "research channels",
      "description": "detailed description"
    }
  ],
  "tone_of_voice": {
    "overview": "Recommended tone of voice description",
    "dimensions": [
      {"label": "Warmth", "from": "Formal", "to": "Warm", "value": 70},
      {"label": "Detail", "from": "Concise", "to": "Detailed", "value": 55},
      {"label": "Style", "from": "Traditional", "to": "Modern", "value": 65}
    ]
  },
  "main_segments": ["Segment 1", "Segment 2", "Segment 3"],
  "brand_attributes": [
    {"title": "Attribute", "description": "Brand attribute description"}
  ],
  "brand_pillars": [
    {"title": "Pillar 1", "description": "Pillar description"}
  ],
  "visual_identity": {"primary_font": "Font name", "secondary_font": "Secondary font name"},
  "icp": {
    "phase1": "Visibility phase description",
    "phase2": "Advertising and partnerships phase description",
    "phase3": "Conversion phase description"
  },
  "go_to_market": {
    "overview": "GTM strategy introductory text",
    "sections": [
      {"title": "Audience Segmentation", "points": ["point 1", "point 2"]},
      {"title": "Content Creation", "points": ["point 1", "point 2"]},
      {"title": "Distribution Channels", "points": ["point 1", "point 2"]},
      {"title": "Digital Presence", "points": ["point 1", "point 2"]},
      {"title": "Remarketing Strategies", "points": ["point 1"]}
    ]
  },
  "competitors_analysis": [
    {"name": "Competitor Name", "followers": "X thousand", "engagement": "X%", "growth": "X%", "analysis": "analysis of similarities and differences"}
  ]
}

Generate 3-4 buyer personas, 5-8 brand attributes, 4 brand pillars, 10+ SEO keywords, 5+ competitors. Be specific and relevant to the "${formData.industry}" segment for "${formData.name}".`;

      const report = await InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            overview: { type: 'string' },
            instagram_metrics: { type: 'object' },
            linkedin_metrics: { type: 'object' },
            sentiment_analysis: { type: 'object' },
            content_formats: { type: 'object' },
            seo_keywords: { type: 'array', items: { type: 'object' } },
            color_psychology: { type: 'object' },
            buyer_personas: { type: 'array', items: { type: 'object' } },
            tone_of_voice: { type: 'object' },
            main_segments: { type: 'array', items: { type: 'string' } },
            brand_attributes: { type: 'array', items: { type: 'object' } },
            brand_pillars: { type: 'array', items: { type: 'object' } },
            visual_identity: { type: 'object' },
            icp: { type: 'object' },
            go_to_market: { type: 'object' },
            competitors_analysis: { type: 'array', items: { type: 'object' } },
          }
        },
        model: 'gemini_3_flash'
      });

      await BrandScan.update(scan.id, {
        status: 'complete',
        report,
      });

      queryClient.invalidateQueries({ queryKey: ['brandscans'] });
      toast.success(language === 'pt' ? 'Brand Scan gerado com sucesso!' : 'Brand Scan generated successfully!');
    } catch (err) {
      toast.error(language === 'pt' ? 'Erro ao gerar Brand Scan' : 'Failed to generate Brand Scan');
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-[#38b6ff]/20 border-t-[#38b6ff] animate-spin" />
          <Sparkles className="w-8 h-8 text-[#38b6ff] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="text-center">
          <h2 className="text-white text-xl font-bold">
            {language === 'pt' ? 'Gerando Brand Scan...' : 'Generating Brand Scan...'}
          </h2>
          <p className="text-gray-400 mt-2 max-w-md">
            {language === 'pt'
              ? 'A IA está analisando sua empresa e preparando o relatório completo. Isso pode levar alguns instantes.'
              : 'The AI is analyzing your company and preparing the full report. This may take a moment.'}
          </p>
        </div>
      </div>
    );
  }

  // Show setup form for new scan
  if (showSetup) {
    return (
      <div>
        <button onClick={() => setShowSetup(false)} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
          ← {language === 'pt' ? 'Voltar' : 'Back'}
        </button>
        <BrandScanSetup company={company} onGenerate={handleGenerate} />
      </div>
    );
  }

  // No scans yet → show setup directly
  if (scans.length === 0) {
    return <BrandScanSetup company={company} onGenerate={handleGenerate} />;
  }

  // Show report view with version history
  return (
    <div className="min-h-screen">
      {/* Version history bar */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <FileSearch className="w-4 h-4 text-[#38b6ff]" />
          <span className="text-white font-medium">
            {language === 'pt' ? 'Versões' : 'Versions'}
          </span>
          <Badge className="bg-white/10 text-gray-400 border-0 text-xs">{completedScans.length}/{MAX_VERSIONS}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 flex-1">
          {completedScans.map((s, idx) => (
            <div key={s.id} className="relative group flex items-center">
              <button
                onClick={() => setActiveScanId(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                  activeScanId === s.id
                    ? 'bg-[#38b6ff]/20 border-[#38b6ff]/40 text-[#38b6ff]'
                    : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">{s.title?.replace('Brand Scan — ', '')}</span>
                <span className="text-xs opacity-70">{new Date(s.created_date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US')}</span>
              </button>
              <button
                onClick={(e) => deleteScan(s.id, e)}
                className="ml-1 p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                title={language === 'pt' ? 'Excluir' : 'Delete'}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <Button
          onClick={() => setShowSetup(true)}
          size="sm"
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          {language === 'pt' ? 'Novo Scan' : 'New Scan'}
        </Button>
      </div>

      {activeScan ? (
        <BrandScanReport scan={activeScan} onReset={() => setShowSetup(true)} language={language} />
      ) : (
        <div className="text-center py-16 text-gray-400">
          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{language === 'pt' ? 'Selecione uma versão acima' : 'Select a version above'}</p>
        </div>
      )}
    </div>
  );
}