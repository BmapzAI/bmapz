import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function Signup() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp({ email, password, full_name: fullName, company_name: companyName });
      setDone(true);
    } catch (err) {
      toast.error(err.message || 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h2 className="text-2xl font-bold text-white">Check your email</h2>
          <p className="text-gray-400">
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Click it to activate your account.
          </p>
          <Link to="/login" className="text-[#38b6ff] hover:underline text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <h1
            className="text-5xl font-bold text-white mb-2"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}
          >
            BMAPZ
          </h1>
          <p className="text-gray-400 text-sm">AI-Powered Marketing Automation</p>
        </div>

        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Create your account</h2>
            <p className="text-gray-400 text-sm mt-1">
              Already have an account?{' '}
              <Link to="/login" className="text-[#38b6ff] hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Google sign-in (direct-to-Google, shows Bmapz on ai.bmapz.com) */}
          <GoogleSignInButton text="signup_with" />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#1a1a1a] px-2 text-gray-500">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fullName" className="text-gray-300 text-sm">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#38b6ff]"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="companyName" className="text-gray-300 text-sm">Company</Label>
                <Input
                  id="companyName"
                  type="text"
                  autoComplete="organization"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#38b6ff]"
                  placeholder="Acme Inc."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300 text-sm">Work email</Label>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-[#38b6ff]"
                placeholder="8+ characters"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#38b6ff] to-[#cb6ce6] text-white font-medium"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600">
          By creating an account you agree to our{' '}
          <Link to="/TermsOfService" className="hover:underline">Terms</Link>
          {' '}and{' '}
          <Link to="/PrivacyPolicy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
