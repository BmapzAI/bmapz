import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed');
      setGoogleLoading(false);
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

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 gap-2"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </Button>

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
