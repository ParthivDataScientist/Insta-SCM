import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, KeyRound, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import '../styles.css';

const QUOTES = [
    { title: "Empower Your Logistics", text: "Streamlining exhibitions and tracking with precision and efficiency." },
    { title: "Data-Driven Decisions", text: "Real-time monitoring for your most critical business assets." },
    { title: "Seamless Operations", text: "Connecting teams, shipments, and projects across the globe." },
    { title: "Excellence in Execution", text: "Delivering flawless exhibition experiences through robust tracking." },
];

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [mfaToken, setMfaToken] = useState(null);
    const [mfaCode, setMfaCode] = useState('');
    const { login, verifyMfa, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/design');
        }
    }, [user, navigate]);

    useEffect(() => {
        const interval = setInterval(() => {
            setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
        }, 7000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            if (mfaToken) {
                // Verify MFA step
                await verifyMfa(mfaToken, mfaCode);
                navigate('/');
            } else {
                // Normal Login Step
                const res = await login(email, password);
                if (res?.requiresMfa) {
                    setMfaToken(res.mfaToken);
                } else {
                    navigate('/');
                }
            }
        } catch (err) {
            setError(err.message || (mfaToken ? 'Invalid MFA code' : 'Invalid email or password'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-left">
                <div className="auth-brand">
                    <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ height: '32px', width: 'auto' }} />
                    <span className="auth-brand-text">Insta-Exhibition-Dashboards</span>
                </div>
                <div className="auth-illustration">
                    <h2 key={`title-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].title}</h2>
                    <p key={`text-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].text}</p>
                </div>
            </div>
            <div className="auth-right">
                <div className="auth-card">
                    <h2>Welcome Back</h2>
                    <p className="auth-subtitle">Secure access to the tracking management system.</p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {!mfaToken ? (
                            <>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} className="input-icon" />
                                        <input
                                            type="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Password</label>
                                    <div className="input-wrapper">
                                        <KeyRound size={18} className="input-icon" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="auth-actions">
                                    <label className="remember-me">
                                        <input type="checkbox" /> Remember me
                                    </label>
                                    <Link to="/forgot-password" className="forgot-password">
                                        Forgot Password?
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="input-group">
                                <label>MFA Authenticator Code</label>
                                <div className="input-wrapper">
                                    <ShieldCheck size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value)}
                                        required
                                        maxLength={6}
                                        style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2em' }}
                                    />
                                </div>
                                <small style={{ color: '#6b7280', marginTop: '0.5rem', display: 'block' }}>Enter the 6-digit code from your authenticator app</small>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary auth-btn"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <LoaderCircle className="spinner" size={18} /> : (mfaToken ? 'Verify Code' : 'Login')}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Don't have an account? <Link to="/register">Create Account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
