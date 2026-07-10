import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn({ email, password });
      // AuthContext will pick up the new session via onAuthStateChange
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Branding */}
        <div className="text-center">
          <h1
            className="text-5xl font-bold text-white mb-2"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}
          >
            BMAPZ
          </h1>
          <p className="text-gray-400 text-sm">AI-Powered Marketing Automation</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
            <p className="text-gray-400 text-sm mt-1">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#38b6ff] hover:underline">Sign up</Link>
            </p>
          </div>

          {/* Google sign-in (direct-to-Google, shows Bmapz on ai.bmapz.com) */}
          <GoogleSignInButton text="signin_with" />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#1a1a1a] px-2 text-gray-500">or</span>
            </div>
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#38b6ff]"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-300 text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#38b6ff]"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#38b6ff] to-[#cb6ce6] text-white font-medium"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600">
          By signing in you agree to our{' '}
          <Link to="/TermsOfService" className="hover:underline">Terms</Link>
          {' '}and{' '}
          <Link to="/PrivacyPolicy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
