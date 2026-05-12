import React from 'react';
import { AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * IntegrationGate — wraps any action that requires a connected integration.
 * 
 * Props:
 *  - integration: key from company.integration_status (e.g. 'whatsapp', 'openai')
 *  - integrationStatus: the full company.integration_status object
 *  - label: human-readable integration name (e.g. 'WhatsApp Business')
 *  - children: the button/action to render when connected
 *  - inline: if true, renders a compact inline warning instead of a block banner
 */
export default function IntegrationGate({ integration, integrationStatus = {}, label, children, inline = false }) {
  const isConnected = integrationStatus[integration] === true;

  if (isConnected) return children;

  if (inline) {
    return (
      <span
        title={`${label} not connected. Go to Settings → API Keys.`}
        className="inline-flex items-center gap-1 opacity-50 cursor-not-allowed"
        onClick={(e) => e.stopPropagation()}
      >
        {React.cloneElement(children, { disabled: true, onClick: undefined })}
      </span>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
      <AlertCircle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-yellow-300 text-xs font-medium">{label} not connected</p>
        <p className="text-gray-400 text-xs mt-0.5">
          Add your API key in{' '}
          <Link to="/Settings" className="text-[#38b6ff] underline hover:text-[#38b6ff]/80">
            Settings → API Keys
          </Link>{' '}
          to enable this feature.
        </p>
      </div>
    </div>
  );
}

/**
 * useIntegrationStatus — convenience hook to get integration statuses from company query.
 * Usage: const { isConnected } = useIntegrationStatus(company, 'whatsapp');
 */
export function useIntegrationStatus(company, integration) {
  const status = company?.integration_status || {};
  return {
    isConnected: status[integration] === true,
    integrationStatus: status,
  };
}