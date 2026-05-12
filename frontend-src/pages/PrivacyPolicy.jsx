import React from 'react';
import { Shield, Lock, Eye, Database, Mail, Globe, Users, FileText } from 'lucide-react';

const Section = ({ icon: Icon, title, children }) =>
<div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 flex items-center justify-center">
        <Icon size={20} className="text-[#38b6ff]" />
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
    <div className="text-gray-400 text-sm leading-relaxed space-y-2">{children}</div>
  </div>;


export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 px-4">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#38b6ff] flex items-center justify-center mx-auto">
          <Shield size={32} className="text-white" />
        </div>
        <h1
          className="text-4xl font-bold text-white tracking-wide"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          
          Privacy Policy
        </h1>
        <p className="text-gray-400 text-sm">Last updated: March 29, 2025</p>
        <p className="text-gray-400 text-sm max-w-xl mx-auto">
          BMAPZ is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our platform.
        </p>
      </div>

      {/* Sections */}
      <Section icon={Database} title="Information We Collect">
        <p>We collect the following types of information:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-white">Account Information:</strong> Name, email address, and profile details provided during registration.</li>
          <li><strong className="text-white">Company Data:</strong> Company name, website, industry, and business details you enter into the platform.</li>
          <li><strong className="text-white">Lead Data:</strong> Contact information and interaction history for leads you manage within BMAPZ.</li>
          <li><strong className="text-white">Integration Credentials:</strong> API keys and tokens for third-party services (e.g., Meta, Google, WhatsApp) you connect to BMAPZ. These are stored securely and encrypted.</li>
          <li><strong className="text-white">Usage Data:</strong> Log data, browser type, IP address, and analytics about how you interact with our platform.</li>
        </ul>
      </Section>

      <Section icon={Eye} title="How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Provide, operate, and maintain the BMAPZ platform and its features.</li>
          <li>Personalize your experience and generate AI-powered insights and recommendations.</li>
          <li>Send outreach messages, workflows, and communications on your behalf through connected integrations.</li>
          <li>Improve our products, develop new features, and conduct analytics.</li>
          <li>Communicate with you about updates, support, and account-related information.</li>
          <li>Comply with legal obligations and enforce our terms of service.</li>
        </ul>
      </Section>

      <Section icon={Globe} title="Third-Party Integrations">
        <p>BMAPZ integrates with third-party platforms such as Meta (Facebook & Instagram), Google, WhatsApp, LinkedIn, and others. When you connect these services:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>We request only the permissions necessary to deliver the features you use.</li>
          <li>Your credentials (API keys, access tokens) are encrypted and stored securely.</li>
          <li>We do not sell or share your integration data with other third parties.</li>
          <li>You may revoke access to any integration at any time from the Integrations settings page.</li>
          <li>Each third-party service has its own privacy policy that governs their data practices.</li>
        </ul>
      </Section>

      <Section icon={Lock} title="Data Security">
        <p>We implement industry-standard security measures to protect your data:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>All data is transmitted over HTTPS (TLS encryption).</li>
          <li>API keys and sensitive credentials are encrypted at rest.</li>
          <li>Access to your data is restricted to authorized personnel only.</li>
          <li>We regularly review our security practices and infrastructure.</li>
        </ul>
        <p className="mt-2">Despite these measures, no method of transmission over the internet is 100% secure. We encourage you to use strong, unique passwords and protect your account credentials.</p>
      </Section>

      <Section icon={Users} title="Data Sharing">
        <p>We do not sell your personal information. We may share your data only in the following circumstances:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-white">Service Providers:</strong> Trusted third-party vendors who assist in operating our platform (e.g., cloud hosting, analytics), bound by confidentiality agreements.</li>
          <li><strong className="text-white">Legal Requirements:</strong> When required by law, regulation, or valid legal process.</li>
          <li><strong className="text-white">Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction.</li>
          <li><strong className="text-white">With Your Consent:</strong> In any other cases, only with your explicit consent.</li>
        </ul>
      </Section>

      <Section icon={Globe} title="Instagram and Meta Platform Data">
        <p>When you connect your Instagram Business account to Bmapz.AI, we receive from the Meta Graph API:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-white">Profile Information:</strong> Username, account ID, follower count, and post count.</li>
          <li><strong className="text-white">Direct Messages:</strong> Inbound messages received via webhook and outbound replies sent through the platform.</li>
          <li><strong className="text-white">Comments:</strong> Comments on your posts.</li>
          <li><strong className="text-white">Aggregated Insights:</strong> Performance analytics and engagement metrics.</li>
        </ul>
        <p className="mt-2">We use this data exclusively to:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Display your inbox and comments inside Bmapz.AI.</li>
          <li>Generate AI-assisted reply suggestions that you must review and approve before sending.</li>
          <li>Show analytics and insights within your dashboard.</li>
        </ul>
        <p className="mt-2"><strong className="text-white">We do not sell, share, or use Instagram data for advertising purposes.</strong></p>
        <p className="mt-2">
          You can disconnect your Instagram account at any time via the Integrations page, or revoke access directly via <strong className="text-white">Instagram Settings &gt; Apps and Websites &gt; Bmapz.AI &gt; Remove</strong>.
        </p>
        <p className="mt-2">
          To request deletion of all Instagram data we hold, please email{' '}
          <a href="mailto:privacy@bmapz.com" className="text-[#38b6ff] hover:underline">contato@bmapz.com</a>{' '}
          or use our{' '}
          <a href="/DataDeletion" className="text-[#38b6ff] hover:underline">Data Deletion Request page</a>.
          We will process all deletion requests within 30 days.
        </p>
      </Section>

      <Section icon={FileText} title="Data Retention">
        <p>We retain your data for as long as your account is active or as needed to provide you services. Specifically:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Account and company data is retained while your account is active.</li>
          <li>Upon account deletion, your personal data will be removed within 30 days, except where retention is required by law.</li>
          <li>Lead and activity logs may be retained in anonymized form for analytical purposes.</li>
        </ul>
      </Section>

      <Section icon={Shield} title="Your Rights">
        <p>Depending on your location, you may have the following rights regarding your data:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-white">Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong className="text-white">Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong className="text-white">Erasure:</strong> Request deletion of your personal data.</li>
          <li><strong className="text-white">Portability:</strong> Request your data in a structured, machine-readable format.</li>
          <li><strong className="text-white">Objection:</strong> Object to certain types of data processing.</li>
        </ul>
        <p className="mt-2">To exercise any of these rights, please contact us at the email below.</p>
      </Section>

      <Section icon={Mail} title="Contact Us">
        <p>If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your data, please contact us:</p>
        <div className="mt-3 space-y-1">
          <p><strong className="text-white">Email:</strong>{' '}
            <a href="mailto:privacy@bmapz.com" className="text-[#38b6ff] hover:underline">privacy@bmapz.com</a>
          </p>
          <p><strong className="text-white">Website:</strong>{' '}
            <a href="https://bmapz.com" target="_blank" rel="noopener noreferrer" className="text-[#38b6ff] hover:underline">https://bmapz.com</a>
          </p>
        </div>
        <p className="mt-3">We will respond to all privacy-related inquiries within 30 days.</p>
      </Section>

      {/* Footer note */}
      <div className="text-center text-gray-500 text-xs pb-4">
        <p>This Privacy Policy may be updated from time to time. We will notify you of significant changes via email or a notice on the platform.</p>
        <p className="mt-1">© {new Date().getFullYear()} BMAPZ. All rights reserved.</p>
      </div>
    </div>);

}