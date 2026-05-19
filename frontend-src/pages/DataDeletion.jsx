import React, { useState } from 'react';
import { Shield, Trash2, CheckCircle } from 'lucide-react';
import { DataDeletionRequest } from '@/api/entities';


export default function DataDeletion() {
  const [form, setForm] = useState({ email: '', instagram_username: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email) {
      setError('Email is required.');
      return;
    }
    setLoading(true);
    setError('');
    await DataDeletionRequest.create({
      email: form.email,
      instagram_username: form.instagram_username || undefined,
      reason: form.reason || undefined,
      status: 'pending'
    });
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center mx-auto">
            <Trash2 size={32} className="text-white" />
          </div>
          <h1
            className="text-4xl font-bold text-white tracking-wide"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
            
            Data Deletion Request
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Submit this form to request deletion of your personal data from Bmapz.AI, including any Instagram data we may hold. We will process your request within 30 days.
          </p>
        </div>

        {submitted ?
        <div className="rounded-2xl bg-white/5 border border-green-500/30 p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Request Received</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your deletion request has been received. We will process it within 30 days and confirm by email.
            </p>
          </div> :

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Email <span className="text-red-400">*</span>
              </label>
              <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#38b6ff]/50 focus:ring-1 focus:ring-[#38b6ff]/30 transition" />
            
            </div>

            {/* Instagram username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Instagram Username <span className="text-gray-500">(optional)</span>
              </label>
              <input
              type="text"
              value={form.instagram_username}
              onChange={(e) => setForm({ ...form, instagram_username: e.target.value })}
              placeholder="@yourusername"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#38b6ff]/50 focus:ring-1 focus:ring-[#38b6ff]/30 transition" />
            
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Reason for Deletion <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Please describe what data you'd like deleted and why..."
              rows={4}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#38b6ff]/50 focus:ring-1 focus:ring-[#38b6ff]/30 transition resize-none" />
            
            </div>

            {error &&
          <p className="text-red-400 text-sm">{error}</p>
          }

            <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition text-sm">
            
              {loading ? 'Submitting...' : 'Submit Deletion Request'}
            </button>

            <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1.5">
              <Shield size={12} />
              Your request is processed within 30 days. Confirmation will be sent to your email.
            </p>
          </form>
        }

        <p className="text-center text-xs text-gray-600">
          Questions? Email{' '}
          <a href="mailto:privacy@bmapz.com" className="text-[#38b6ff] hover:underline">contato@bmapz.com

          </a>
        </p>
      </div>
    </div>);

}