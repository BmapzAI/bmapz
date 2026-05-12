import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, FileText, RotateCcw, Instagram, Linkedin, Youtube, Globe,
  Users, TrendingUp, Target, Mic, Palette, Star, Layers,
  Award, Lightbulb, Rocket, Search
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Tooltips by section title — both PT and EN keys
const SECTION_TOOLTIPS = {
  // PT
  'Visão Geral': 'Resumo estratégico da presença digital da marca, posicionamento atual e principais oportunidades identificadas pela IA.',
  'Métricas — Instagram': 'Análise do desempenho no Instagram: seguidores, engajamento, formatos de conteúdo e sentimento da audiência.',
  'Métricas — LinkedIn': 'Presença e performance no LinkedIn, incluindo frequência de publicações e temas mais engajados.',
  'SEO — Tráfego de Keywords': 'Palavras-chave relevantes para o negócio com volume de busca estimado e custo por clique (CPC).',
  'Psicologia das Cores': 'Análise das cores da marca e como elas influenciam a percepção do público e as emoções associadas.',
  'Buyer Personas': 'Perfis detalhados dos clientes ideais com comportamentos, desafios e canais de comunicação preferidos.',
  'Tom de Voz': 'Como a marca se comunica: formal/informal, técnico/acessível e outros espectros de comunicação.',
  'Principais Segmentos de Mercado': 'Os nichos e segmentos de mercado mais relevantes para a marca com base no seu posicionamento.',
  'Atributos da Marca': 'Características e qualidades que definem a identidade e o valor percebido da marca pelo mercado.',
  'Pilares da Marca': 'Os pilares estratégicos que sustentam o posicionamento e a autoridade da marca.',
  'ICP — Perfil de Cliente Ideal': 'As três fases da jornada para atrair e converter o cliente ideal: Visibilidade, Publicidade e Conversão.',
  'Estratégia Go-To-Market': 'Plano estratégico para lançamento ou expansão no mercado com foco em canais, público e mensagem.',
  'Análise de Concorrentes': 'Mapeamento dos principais concorrentes com análise de presença digital, engajamento e diferencial.',
  'Informações Importantes': 'Orientações sobre como manter as estratégias atualizadas e aproveitar ao máximo este relatório.',
  // EN
  'Overview': 'Strategic summary of the brand\'s digital presence, current positioning, and key opportunities identified by AI.',
  'Instagram Metrics': 'Analysis of Instagram performance: followers, engagement, content formats, and audience sentiment.',
  'LinkedIn Metrics': 'LinkedIn presence and performance, including posting frequency and most engaged topics.',
  'SEO — Keyword Traffic': 'Keywords relevant to the business with estimated search volume and cost per click (CPC).',
  'Color Psychology': 'Analysis of brand colors and how they influence audience perception and associated emotions.',
  'Tone of Voice': 'How the brand communicates: formal/informal, technical/accessible, and other communication spectrums.',
  'Main Market Segments': 'The most relevant niches and market segments for the brand based on its positioning.',
  'Brand Attributes': 'Characteristics and qualities that define the brand\'s identity and perceived market value.',
  'Brand Pillars': 'The strategic pillars that underpin the brand\'s positioning and authority.',
  'ICP — Ideal Customer Profile': 'The three phases of the journey to attract and convert the ideal customer: Visibility, Advertising, and Conversion.',
  'Go-To-Market Strategy': 'Strategic plan for market launch or expansion focusing on channels, audience, and message.',
  'Competitor Analysis': 'Mapping of main competitors with digital presence analysis, engagement, and differentiators.',
  'Important Information': 'Guidelines on keeping strategies updated and making the most of this report.',
};

const Section = ({ icon: Icon, title, color = '#38b6ff', children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltip = SECTION_TOOLTIPS[title];
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10" style={{ borderLeft: `4px solid ${color}` }}>
        <Icon className="w-5 h-5" style={{ color }} />
        <div className="relative flex items-center gap-2">
          <h2
            className={`text-white font-bold text-lg ${tooltip ? 'cursor-help' : ''}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {title}
          </h2>
          {tooltip && showTooltip && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 p-3 rounded-xl bg-[#1a1a1a] border border-white/20 shadow-2xl text-gray-300 text-xs leading-relaxed">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
};

const MetricBar = ({ label, value, max = 100, color = '#38b6ff' }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-sm">
      <span className="text-gray-300">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((parseFloat(value) / max) * 100, 100)}%`, background: color }} />
    </div>
  </div>
);

const PersonaCard = ({ persona, isPt }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
    <div>
      <h3 className="text-white font-bold text-base">{persona.name}</h3>
      <p className="text-[#38b6ff] text-sm">{persona.role} — {persona.age} {isPt ? 'anos' : 'yrs'}, {persona.location}</p>
    </div>
    <div className="space-y-2 text-sm text-gray-300">
      <p><span className="text-gray-400 font-medium">{isPt ? 'Tom de voz:' : 'Tone:'}</span> {persona.tone}</p>
      <p><span className="text-gray-400 font-medium">{isPt ? 'Desafios:' : 'Challenges:'}</span> {persona.challenges}</p>
      <p><span className="text-gray-400 font-medium">{isPt ? 'Canais:' : 'Channels:'}</span> {persona.channels}</p>
    </div>
  </div>
);

const COLORS = ['#38b6ff', '#cb6ce6', '#3572b9', '#00e7ff', '#f59e0b'];

export default function BrandScanReport({ scan, onReset, language = 'en' }) {
  const reportRef = useRef(null);
  const r = scan.report || {};
  const cd = scan.company_data || {};
  const isPt = language === 'pt';

  // Bilingual section label helper
  const L = (ptText, enText) => isPt ? ptText : enText;

  const sentimentData = r.sentiment_analysis ? [
    { name: 'Positivo', value: parseFloat(r.sentiment_analysis.positive) || 54 },
    { name: 'Neutro', value: parseFloat(r.sentiment_analysis.neutral) || 43 },
    { name: 'Negativo', value: parseFloat(r.sentiment_analysis.negative) || 3 },
  ] : [
    { name: 'Positivo', value: 54 },
    { name: 'Neutro', value: 43 },
    { name: 'Negativo', value: 3 },
  ];

  const formatData = r.content_formats ? [
    { name: 'Reels', value: r.content_formats.reels || 50 },
    { name: 'Carrossel', value: r.content_formats.carousel || 25 },
    { name: 'Imagem', value: r.content_formats.image || 23 },
    { name: 'Vídeo', value: r.content_formats.video || 2 },
  ] : [
    { name: 'Reels', value: 50 },
    { name: 'Carrossel', value: 25 },
    { name: 'Imagem', value: 23 },
    { name: 'Vídeo', value: 2 },
  ];

  const handleExportPDF = async () => {
    const element = reportRef.current;
    const canvas = await html2canvas(element, { scale: 1.2, useCORS: true, backgroundColor: '#0a0a0a' });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`brand-scan-${cd.name || 'report'}.pdf`);
  };

  const handleExportText = () => {
    const text = `BRAND SCAN - ${cd.name || 'Empresa'}\n${'='.repeat(50)}\n\n${r.overview || ''}\n\n` +
      (r.buyer_personas || []).map(p => `BUYER PERSONA: ${p.name}\n${p.description || ''}`).join('\n\n') +
      `\n\nGO-TO-MARKET\n${r.go_to_market?.overview || ''}\n\n` +
      `SEO KEYWORDS\n${(r.seo_keywords || []).map(k => `- ${k.keyword} (Volume: ${k.volume})`).join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-scan-${cd.name || 'report'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Brand Scan — {cd.name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{L('Relatório gerado por IA', 'AI-generated report')} • {new Date(scan.updated_date).toLocaleDateString(isPt ? 'pt-BR' : 'en-US')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5">
            <RotateCcw className="w-4 h-4 mr-2" /> {L('Novo Scan', 'New Scan')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportText} className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5">
            <FileText className="w-4 h-4 mr-2" /> {L('Exportar TXT', 'Export TXT')}
          </Button>
          <Button size="sm" onClick={handleExportPDF} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] text-white border-0">
            <Download className="w-4 h-4 mr-2" /> {L('Exportar PDF', 'Export PDF')}
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-0">
        {/* Overview */}
        <Section icon={Rocket} title={L('Visão Geral', 'Overview')} color="#38b6ff">
          <p className="text-gray-300 leading-relaxed">{r.overview || L('Carregando análise...', 'Loading analysis...')}</p>
          {cd.website && (
            <div className="mt-4 flex flex-wrap gap-3">
              {cd.instagram && <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20"><Instagram className="w-3 h-3 mr-1" />{cd.instagram}</Badge>}
              {cd.linkedin && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Linkedin className="w-3 h-3 mr-1" />{cd.linkedin}</Badge>}
              {cd.youtube && <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><Youtube className="w-3 h-3 mr-1" />{cd.youtube}</Badge>}
              {cd.website && <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><Globe className="w-3 h-3 mr-1" />{cd.website}</Badge>}
            </div>
          )}
        </Section>

        {/* Instagram Metrics */}
        <Section icon={Instagram} title={L('Métricas — Instagram', 'Instagram Metrics')} color="#e1306c">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {(r.instagram_metrics || {}) && Object.entries({
                [L('Seguidores', 'Followers')]: r.instagram_metrics?.followers || '—',
                [L('Audiência Genuína', 'Genuine Audience')]: r.instagram_metrics?.audience || '—',
                [L('Taxa de Engajamento', 'Engagement Rate')]: r.instagram_metrics?.engagement || '—',
                [L('Crescimento', 'Growth')]: r.instagram_metrics?.growth || '—',
                [L('Frequência de Posts', 'Post Frequency')]: r.instagram_metrics?.frequency || '—',
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400 text-sm">{k}</span>
                  <span className="text-white font-medium text-sm">{v}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-3">{L('Engajamento por Formato', 'Engagement by Format')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={formatData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                    {formatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {formatData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    {d.name}: {d.value}%
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audience interests */}
          {r.instagram_metrics?.interests && (
            <div className="mt-6 space-y-3">
              <p className="text-gray-400 text-sm">{L('Interesses da Audiência', 'Audience Interests')}</p>
              {r.instagram_metrics.interests.map((item, i) => (
                <MetricBar key={i} label={item.category} value={`${item.percentage}%`} max={100} color={COLORS[i % COLORS.length]} />
              ))}
            </div>
          )}

          {/* Sentiment */}
          <div className="mt-6">
            <p className="text-gray-400 text-sm mb-3">{L('Análise de Sentimento', 'Sentiment Analysis')}</p>
            <div className="grid grid-cols-3 gap-3">
              {sentimentData.map((s, i) => (
                <div key={s.name} className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-2xl font-bold" style={{ color: COLORS[i] }}>{s.value}%</p>
                  <p className="text-gray-400 text-xs mt-1">{s.name}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* LinkedIn */}
        <Section icon={Linkedin} title={L('Métricas — LinkedIn', 'LinkedIn Metrics')} color="#0077b5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries({
              [L('Seguidores', 'Followers')]: r.linkedin_metrics?.followers || '—',
              [L('Posts (30d)', 'Posts (30d)')]: r.linkedin_metrics?.posts_30d || '—',
              [L('Artigos (30d)', 'Articles (30d)')]: r.linkedin_metrics?.articles_30d || '—',
              [L('Engajamento Médio', 'Avg. Engagement')]: r.linkedin_metrics?.avg_engagement || '—',
            }).map(([k, v]) => (
              <div key={k} className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-white">{v}</p>
                <p className="text-gray-400 text-xs mt-1">{k}</p>
              </div>
            ))}
          </div>
          {r.linkedin_metrics?.top_themes && (
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">{L('Principais Temas', 'Top Themes')}</p>
              <div className="flex flex-wrap gap-2">
                {r.linkedin_metrics.top_themes.map((t, i) => (
                  <Badge key={i} className="bg-blue-500/10 text-blue-300 border-blue-500/20">{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* SEO Keywords */}
        <Section icon={Search} title={L('SEO — Tráfego de Keywords', 'SEO — Keyword Traffic')} color="#10b981">
          {r.seo_keywords?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 pb-2 font-medium">{L('Palavra-Chave', 'Keyword')}</th>
                    <th className="text-left text-gray-400 pb-2 font-medium">{L('Volume', 'Volume')}</th>
                    <th className="text-left text-gray-400 pb-2 font-medium">CPC</th>
                    <th className="text-left text-gray-400 pb-2 font-medium">{L('Relevância', 'Relevance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {r.seo_keywords.map((kw, i) => (
                    <tr key={i}>
                      <td className="py-2 text-white">{kw.keyword}</td>
                      <td className="py-2 text-gray-300">{kw.volume}</td>
                      <td className="py-2 text-gray-300">{kw.cpc || '—'}</td>
                      <td className="py-2">
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">{kw.relevance || L('Alta', 'High')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">{L('Keywords serão geradas com base no segmento e serviços da empresa.', 'Keywords will be generated based on the company segment and services.')}</p>
          )}
        </Section>

        {/* Color Psychology */}
        <Section icon={Palette} title={L('Psicologia das Cores', 'Color Psychology')} color="#cb6ce6">
          <p className="text-gray-300 text-sm mb-4">{r.color_psychology?.description || L('A paleta de cores foi definida com base no segmento, público-alvo e posicionamento da marca.', 'The color palette was defined based on the segment, target audience, and brand positioning.')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(r.color_psychology?.colors || [
              { name: 'Cor Primária', hex: '#0d9488', description: 'Confiança, sofisticação e autoridade' },
              { name: 'Cor Secundária', hex: '#f0fdfa', description: 'Pureza, clareza e leveza' },
              { name: 'Destaque', hex: '#ec4899', description: 'Empoderamento e liderança feminina' },
            ]).map((c, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 rounded-xl p-4">
                <div className="w-12 h-12 rounded-lg flex-shrink-0 border border-white/10" style={{ background: c.hex }} />
                <div>
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Buyer Personas */}
        <Section icon={Users} title={L('Buyer Personas', 'Buyer Personas')} color="#f59e0b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(r.buyer_personas || []).map((p, i) => (
              <PersonaCard key={i} persona={p} isPt={isPt} />
            ))}
          </div>
        </Section>

        {/* Tone of Voice */}
        <Section icon={Mic} title={L('Tom de Voz', 'Tone of Voice')} color="#8b5cf6">
          <p className="text-gray-300 text-sm mb-4">{r.tone_of_voice?.overview}</p>
          {r.tone_of_voice?.dimensions && (
            <div className="space-y-3">
              {r.tone_of_voice.dimensions.map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{d.from}</span><span>{d.to}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#3572b9] to-[#cb6ce6] rounded-full" style={{ width: `${d.value || 60}%` }} />
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{d.label}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Main Segments */}
        <Section icon={Target} title={L('Principais Segmentos de Mercado', 'Main Market Segments')} color="#06b6d4">
          <div className="flex flex-wrap gap-2">
            {(r.main_segments || []).map((s, i) => (
              <Badge key={i} className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 px-3 py-1.5">{s}</Badge>
            ))}
          </div>
        </Section>

        {/* Brand Attributes */}
        <Section icon={Star} title={L('Atributos da Marca', 'Brand Attributes')} color="#f59e0b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(r.brand_attributes || []).map((a, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{a.title}</p>
                <p className="text-gray-400 text-xs mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Brand Pillars */}
        <Section icon={Layers} title={L('Pilares da Marca', 'Brand Pillars')} color="#10b981">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(r.brand_pillars || []).map((p, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] flex items-center justify-center mx-auto">
                  <span className="text-white font-bold">{i + 1}</span>
                </div>
                <p className="text-white font-semibold text-sm">{p.title}</p>
                <p className="text-gray-400 text-xs">{p.description}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ICP */}
        <Section icon={TrendingUp} title={L('ICP — Perfil de Cliente Ideal', 'ICP — Ideal Customer Profile')} color="#3572b9">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: L('1ª Fase: Visibilidade', 'Phase 1: Visibility'), content: r.icp?.phase1 },
              { title: L('2ª Fase: Publicidade', 'Phase 2: Advertising'), content: r.icp?.phase2 },
              { title: L('3ª Fase: Conversão', 'Phase 3: Conversion'), content: r.icp?.phase3 },
            ].map((phase, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <p className="text-[#38b6ff] font-semibold text-sm mb-2">{phase.title}</p>
                <p className="text-gray-300 text-sm">{phase.content || '—'}</p>
              </div>
            ))}
          </div>
        </Section>



        {/* Go-To-Market */}
        <Section icon={Rocket} title={L('Estratégia Go-To-Market', 'Go-To-Market Strategy')} color="#cb6ce6">
          <div className="space-y-4 text-sm text-gray-300">
            {r.go_to_market?.overview && <p className="text-gray-300">{r.go_to_market.overview}</p>}
            {(r.go_to_market?.sections || []).map((s, i) => (
              <div key={i}>
                <p className="text-white font-semibold mb-1">{s.title}</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  {(s.points || []).map((pt, j) => <li key={j}>{pt}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>



        {/* Competitors */}
        <Section icon={Award} title={L('Análise de Concorrentes', 'Competitor Analysis')} color="#ef4444">
          <div className="space-y-4">
            {(r.competitors_analysis || []).map((c, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-bold">{c.name}</p>
                  {c.followers && <Badge className="bg-red-500/10 text-red-400 border-red-500/20">{c.followers} {L('seguidores', 'followers')}</Badge>}
                </div>
                <p className="text-gray-400 text-sm">{c.analysis}</p>
                {c.engagement && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <span>{L('Engajamento', 'Engagement')}: {c.engagement}</span>
                    <span>{L('Crescimento', 'Growth')}: {c.growth || '—'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Important notes */}
        <Section icon={Lightbulb} title={L('Informações Importantes', 'Important Information')} color="#f59e0b">
          <p className="text-gray-300 text-sm">
            {L(
              'Esta pesquisa é feita com o cenário atual do mercado, por isso, recomendamos a atualização do Brand Scan a cada 30 dias para manter as estratégias atualizadas com as mudanças do mercado. Esta abordagem dinâmica fortalece a adaptação às tendências e otimiza o desempenho das estratégias implementadas.',
              'This research reflects the current market scenario. We recommend updating the Brand Scan every 30 days to keep strategies aligned with market changes. This dynamic approach strengthens adaptation to trends and optimizes the performance of implemented strategies.'
            )}
          </p>
        </Section>
      </div>
    </div>
  );
}