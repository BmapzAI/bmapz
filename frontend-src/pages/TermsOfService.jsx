import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: '1. Acceptance of Terms / Aceitação dos Termos',
    content: `By accessing or using BMAPZ ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.

Ao acessar ou usar o BMAPZ ("a Plataforma"), você concorda em se vincular a estes Termos de Serviço. Se você não concordar, por favor não use a Plataforma.`,
  },
  {
    title: '2. Description of Service / Descrição do Serviço',
    content: `BMAPZ provides an AI-powered sales and marketing automation platform, including lead management, workflow automation, AI-generated content, ad campaign management, and integrations with third-party services.

O BMAPZ fornece uma plataforma de automação de vendas e marketing com IA, incluindo gestão de leads, automação de fluxos, conteúdo gerado por IA, gestão de campanhas publicitárias e integrações com serviços de terceiros.`,
  },
  {
    title: '3. User Accounts / Contas de Usuário',
    content: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.

Você é responsável por manter a confidencialidade das suas credenciais de conta. Você concorda em nos notificar imediatamente sobre qualquer uso não autorizado da sua conta. Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.`,
  },
  {
    title: '4. Acceptable Use / Uso Aceitável',
    content: `You agree not to use the Platform to:
• Send unsolicited bulk messages (spam)
• Violate any applicable laws or regulations
• Infringe on third-party intellectual property rights
• Attempt to gain unauthorized access to any systems
• Distribute malicious code or content

Você concorda em não usar a Plataforma para:
• Enviar mensagens em massa não solicitadas (spam)
• Violar quaisquer leis ou regulamentos aplicáveis
• Infringir direitos de propriedade intelectual de terceiros
• Tentar obter acesso não autorizado a qualquer sistema
• Distribuir código ou conteúdo malicioso`,
  },
  {
    title: '5. Subscriptions & Billing / Assinaturas e Cobrança',
    content: `Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable unless otherwise stated. We reserve the right to change pricing with 30 days` notice. Failure to pay may result in service suspension.

As taxas de assinatura são cobradas antecipadamente mensal ou anualmente. Todas as taxas não são reembolsáveis, salvo indicação em contrário. Reservamo-nos o direito de alterar os preços com 30 dias de antecedência. O não pagamento pode resultar na suspensão do serviço.\`,
  },
  {
    title: `6. Intellectual Property / Propriedade Intelectual`,
    content: \`All content, features, and functionality of the Platform are owned by BMAPZ and are protected by international copyright, trademark, and other intellectual property laws. You retain ownership of your data and content uploaded to the Platform.

Todo o conteúdo, recursos e funcionalidades da Plataforma são de propriedade do BMAPZ e são protegidos por leis internacionais de direitos autorais, marcas registradas e outras leis de propriedade intelectual. Você mantém a propriedade dos seus dados e conteúdos enviados para a Plataforma.\`,
  },
  {
    title: `7. AI-Generated Content / Conteúdo Gerado por IA`,
    content: \`The Platform uses artificial intelligence to generate content such as messages, emails, and ad copy. You are solely responsible for reviewing, editing, and approving any AI-generated content before use. BMAPZ does not guarantee the accuracy, completeness, or suitability of AI-generated content.

A Plataforma usa inteligência artificial para gerar conteúdo como mensagens, e-mails e textos de anúncios. Você é o único responsável por revisar, editar e aprovar qualquer conteúdo gerado por IA antes do uso. O BMAPZ não garante a precisão, integridade ou adequação do conteúdo gerado por IA.\`,
  },
  {
    title: `8. Third-Party Integrations / Integrações de Terceiros`,
    content: \`The Platform integrates with third-party services (Google, Meta, LinkedIn, WhatsApp, etc.). Your use of these integrations is subject to the respective third-party terms of service. BMAPZ is not responsible for the availability or functionality of third-party services.

A Plataforma integra-se com serviços de terceiros (Google, Meta, LinkedIn, WhatsApp, etc.). O uso dessas integrações está sujeito aos respectivos termos de serviço de terceiros. O BMAPZ não é responsável pela disponibilidade ou funcionalidade de serviços de terceiros.\`,
  },
  {
    title: `9. Data & Privacy / Dados e Privacidade`,
    content: \`Your use of the Platform is also governed by our Privacy Policy. We collect and process data as described therein. By using the Platform, you consent to such processing.

O uso da Plataforma também é regido pela nossa Política de Privacidade. Coletamos e processamos dados conforme descrito nela. Ao usar a Plataforma, você consente com esse processamento.\`,
  },
  {
    title: `10. Limitation of Liability / Limitação de Responsabilidade`,
    content: \`To the maximum extent permitted by law, BMAPZ shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the amount paid by you in the preceding 12 months.

Na extensão máxima permitida por lei, o BMAPZ não será responsável por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos decorrentes do uso da Plataforma. Nossa responsabilidade total não excederá o valor pago por você nos 12 meses anteriores.\`,
  },
  {
    title: `11. Termination / Rescisão`,
    content: \`Either party may terminate this agreement at any time. Upon termination, your access to the Platform will cease. We may retain your data for up to 90 days after termination before deletion, unless required by law to retain it longer.

Qualquer das partes pode encerrar este acordo a qualquer momento. Após o encerramento, seu acesso à Plataforma cessará. Podemos reter seus dados por até 90 dias após o encerramento antes da exclusão, salvo se exigido por lei para retê-los por mais tempo.\`,
  },
  {
    title: `12. Governing Law / Lei Aplicável`,
    content: \`These Terms are governed by the laws of Brazil. Any disputes shall be resolved in the courts of São Paulo, Brazil.

Estes Termos são regidos pelas leis do Brasil. Quaisquer disputas serão resolvidas nos tribunais de São Paulo, Brasil.\`,
  },
  {
    title: `13. Changes to Terms / Alterações nos Termos`,
    content: \`We may update these Terms from time to time. We will notify you of material changes via email or in-app notification. Continued use of the Platform after changes constitutes acceptance.

Podemos atualizar estes Termos periodicamente. Notificaremos você sobre mudanças relevantes por e-mail ou notificação no aplicativo. O uso continuado da Plataforma após as alterações constitui aceitação.\`,
  },
  {
    title: `14. Contact / Contato`,
    content: \`For questions about these Terms, contact us at: contato@bmapz.com

Para dúvidas sobre estes Termos, entre em contato: contato@bmapz.com\`,
  },
];

export default function TermsOfService() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/Help">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Help Center
          </Button>
        </Link>
      </div>

      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3572b9]/30 to-[#cb6ce6]/30 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-[#38b6ff]" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "`Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          Terms of Service / Termos de Serviço
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Last updated / Última atualização: May 2026</p>
      </div>

      {/* Introduction */}
      <div className="rounded-2xl bg-[#3572b9]/10 border border-[#3572b9]/30 p-5">
        <p className="text-gray-300 text-sm leading-relaxed">
          Please read these Terms of Service carefully before using the BMAPZ platform. These terms constitute a legal agreement between you and BMAPZ.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mt-2">
          Por favor, leia estes Termos de Serviço cuidadosamente antes de usar a plataforma BMAPZ. Estes termos constituem um acordo legal entre você e o BMAPZ.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <div key={index} className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h2 className="text-white font-semibold mb-3 text-base">{section.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Footer links */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-400 text-sm">Related policies / Políticas relacionadas:</p>
        <div className="flex gap-3">
          <Link to="/PrivacyPolicy">
            <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 gap-2 text-xs">
              <Shield className="w-3.5 h-3.5" /> Privacy Policy
            </Button>
          </Link>
          <Link to="/Help">
            <Button variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 text-xs">
              Help Center
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}