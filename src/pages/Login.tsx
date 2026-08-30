import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(name, email, password, phone);
        setSuccess('Account created successfully! Please sign in.');
        setIsSignUp(false);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
      } else {
        await signIn(email, password);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      setSuccess('Password reset link sent! Please check your email inbox.');
      setForgotEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#024CDB] mb-2">Docflo</h1>
          <p className="text-gray-600">AI-assisted OPD workflow</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {showForgotPassword ? (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Reset Password</h2>
              <p className="text-sm text-gray-600 mb-6">Enter your email and we'll send you a link to reset your password.</p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="input-field"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
                )}

                {success && (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{success}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setShowForgotPassword(false); setError(''); setSuccess(''); setForgotEmail(''); }}
                  className="text-sm text-[#024CDB] hover:underline"
                >
                  ← Back to Sign In
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                {isSignUp && (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile No (optional)
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    required
                    minLength={6}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
                )}

                {success && (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{success}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-[#024CDB] hover:underline"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>

              {!isSignUp && (
                <div className="mt-2 text-center">
                  <button
                    onClick={() => { setShowForgotPassword(true); setError(''); setSuccess(''); }}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}