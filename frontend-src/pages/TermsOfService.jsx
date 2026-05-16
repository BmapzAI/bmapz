import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: '1. Acceptance of Terms / Aceita��o dos Termos',
    content: `By accessing or using BMAPZ ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.

Ao acessar ou usar o BMAPZ ("a Plataforma"), voc� concorda em se vincular a estes Termos de Servi�o. Se voc� n�o concordar, por favor n�o use a Plataforma.`,
  },
  {
    title: '2. Description of Service / Descri��o do Servi�o',
    content: `BMAPZ provides an AI-powered sales and marketing automation platform, including lead management, workflow automation, AI-generated content, ad campaign management, and integrations with third-party services.

O BMAPZ fornece uma plataforma de automa��o de vendas e marketing com IA, incluindo gest�o de leads, automa��o de fluxos, conte�do gerado por IA, gest�o de campanhas publicit�rias e integra��es com servi�os de terceiros.`,
  },
  {
    title: '3. User Accounts / Contas de Usu�rio',
    content: `You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.

Voc� � respons�vel por manter a confidencialidade das suas credenciais de conta. Voc� concorda em nos notificar imediatamente sobre qualquer uso n�o autorizado da sua conta. Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.`,
  },
  {
    title: '4. Acceptable Use / Uso Aceit�vel',
    content: `You agree not to use the Platform to:
" Send unsolicited bulk messages (spam)
" Violate any applicable laws or regulations
" Infringe on third-party intellectual property rights
" Attempt to gain unauthorized access to any systems
" Distribute malicious code or content

Voc� concorda em n�o usar a Plataforma para:
" Enviar mensagens em massa n�o solicitadas (spam)
" Violar quaisquer leis ou regulamentos aplic�veis
" Infringir direitos de propriedade intelectual de terceiros
" Tentar obter acesso n�o autorizado a qualquer sistema
" Distribuir c�digo ou conte�do malicioso`,
  },
  {
    title: '5. Subscriptions & Billing / Assinaturas e Cobran�a',
    content: `Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable unless otherwise stated. We reserve the right to change pricing with 30 days' notice. Failure to pay may result in service suspension.

As taxas de assinatura s�o cobradas antecipadamente mensal ou anualmente. Todas as taxas n�o s�o reembols�veis, salvo indica��o em contr�rio. Reservamo-nos o direito de alterar os pre�os com 30 dias de anteced�ncia. O n�o pagamento pode resultar na suspens�o do servi�o.`,
  },
  {
    title: '6. Intellectual Property / Propriedade Intelectual',
    content: `All content, features, and functionality of the Platform are owned by BMAPZ and are protected by international copyright, trademark, and other intellectual property laws. You retain ownership of your data and content uploaded to the Platform.

Todo o conte�do, recursos e funcionalidades da Plataforma s�o de propriedade do BMAPZ e s�o protegidos por leis internacionais de direitos autorais, marcas registradas e outras leis de propriedade intelectual. Voc� mant�m a propriedade dos seus dados e conte�dos enviados para a Plataforma.`,
  },
  {
    title: '7. AI-Generated Content / Conte�do Gerado por IA',
    content: `The Platform uses artificial intelligence to generate content such as messages, emails, and ad copy. You are solely responsible for reviewing, editing, and approving any AI-generated content before use. BMAPZ does not guarantee the accuracy, completeness, or suitability of AI-generated content.

A Plataforma usa intelig�ncia artificial para gerar conte�do como mensagens, e-mails e textos de an�ncios. Voc� � o �nico respons�vel por revisar, editar e aprovar qualquer conte�do gerado por IA antes do uso. O BMAPZ n�o garante a precis�o, integridade ou adequa��o do conte�do gerado por IA.`,
  },
  {
    title: '8. Third-Party Integrations / Integra��es de Terceiros',
    content: `The Platform integrates with third-party services (Google, Meta, LinkedIn, WhatsApp, etc.). Your use of these integrations is subject to the respective third-party terms of service. BMAPZ is not responsible for the availability or functionality of third-party services.

A Plataforma integra-se com servi�os de terceiros (Google, Meta, LinkedIn, WhatsApp, etc.). O uso dessas integra��es est� sujeito aos respectivos termos de servi�o de terceiros. O BMAPZ n�o � respons�vel pela disponibilidade ou funcionalidade de servi�os de terceiros.`,
  },
  {
    title: '9. Data & Privacy / Dados e Privacidade',
    content: `Your use of the Platform is also governed by our Privacy Policy. We collect and process data as described therein. By using the Platform, you consent to such processing.

O uso da Plataforma tamb�m � regido pela nossa Pol�tica de Privacidade. Coletamos e processamos dados conforme descrito nela. Ao usar a Plataforma, voc� consente com esse processamento.`,
  },
  {
    title: '10. Limitation of Liability / Limita��o de Responsabilidade',
    content: `To the maximum extent permitted by law, BMAPZ shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the amount paid by you in the preceding 12 months.

Na extens�o m�xima permitida por lei, o BMAPZ n�o ser� respons�vel por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos decorrentes do uso da Plataforma. Nossa responsabilidade total n�o exceder� o valor pago por voc� nos 12 meses anteriores.`,
  },
  {
    title: '11. Termination / Rescis�o',
    content: `Either party may terminate this agreement at any time. Upon termination, your access to the Platform will cease. We may retain your data for up to 90 days after termination before deletion, unless required by law to retain it longer.

Qualquer das partes pode encerrar este acordo a qualquer momento. Ap�s o encerramento, seu acesso � Plataforma cessar�. Podemos reter seus dados por at� 90 dias ap�s o encerramento antes da exclus�o, salvo se exigido por lei para ret�-los por mais tempo.`,
  },
  {
    title: '12. Governing Law / Lei Aplic�vel',
    content: `These Terms are governed by the laws of Brazil. Any disputes shall be resolved in the courts of S�o Paulo, Brazil.

Estes Termos s�o regidos pelas leis do Brasil. Quaisquer disputas ser�o resolvidas nos tribunais de S�o Paulo, Brasil.`,
  },
  {
    title: '13. Changes to Terms / Altera��es nos Termos',
    content: `We may update these Terms from time to time. We will notify you of material changes via email or in-app notification. Continued use of the Platform after changes constitutes acceptance.

Podemos atualizar estes Termos periodicamente. Notificaremos voc� sobre mudan�as relevantes por e-mail ou notifica��o no aplicativo. O uso continuado da Plataforma ap�s as altera��es constitui aceita��o.`,
  },
  {
    title: '14. Contact / Contato',
    content: `For questions about these Terms, contact us at: contato@bmapz.com

Para d�vidas sobre estes Termos, entre em contato: contato@bmapz.com`,
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
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          Terms of Service / Termos de Servi�o
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Last updated / �ltima atualiza��o: May 2026</p>
      </div>

      {/* Introduction */}
      <div className="rounded-2xl bg-[#3572b9]/10 border border-[#3572b9]/30 p-5">
        <p className="text-gray-300 text-sm leading-relaxed">
          Please read these Terms of Service carefully before using the BMAPZ platform. These terms constitute a legal agreement between you and BMAPZ.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mt-2">
          Por favor, leia estes Termos de Servi�o cuidadosamente antes de usar a plataforma BMAPZ. Estes termos constituem um acordo legal entre voc� e o BMAPZ.
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
        <p className="text-gray-400 text-sm">Related policies / Pol�ticas relacionadas:</p>
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