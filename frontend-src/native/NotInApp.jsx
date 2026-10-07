import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Stands in for the Billing and Pricing screens inside the Android / iOS apps.
 *
 * The app build REPLACES those two modules with this one (see vite.config.js, plugin bmapz-native-billing-removed), so the purchase code
 * is not merely hidden in the app, it is not in the bundle at all (mobile/scripts/check-bundle.mjs proves it on every build).
 * The wording is deliberately neutral: it does not say where to buy, link anywhere, or invite anyone to buy, because the stores treat that
 * as steering people around their payment system.
 */
export default function NotInApp() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-white">Not available in the app</h1>
        <p className="text-sm text-gray-400">This screen can&apos;t be used here.</p>
        <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]">Back to home</Button>
      </div>
    </div>
  );
}
