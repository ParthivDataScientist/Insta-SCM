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
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [mfaFocused, setMfaFocused] = useState(false);
    
    const { login, verifyMfa, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        localStorage.setItem('tenant_id', 'insta');
    }, []);

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
                await verifyMfa(mfaToken, mfaCode);
                navigate('/');
            } else {
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

    const brand = {
        name: "Insta-Exhibition-Dashboards",
        subtitle: "Secure access to the tracking management system.",
        logo: (
            <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ height: '32px', width: 'auto' }} />
        ),
        leftBg: 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)',
        leftIllustration: (
            <div className="auth-illustration">
                <h2 key={`title-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].title}</h2>
                <p key={`text-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].text}</p>
            </div>
        )
    };

    return (
        <div className="auth-container">
            <div className="auth-left" style={{ background: brand.leftBg, position: 'relative', overflow: 'hidden' }}>
                <div className="auth-brand" style={{ background: 'white', padding: '0.5rem 1rem', border: 'none' }}>
                    {brand.logo}
                    <span className="auth-brand-text">Insta-Exhibition-Dashboards</span>
                </div>
                {brand.leftIllustration}
            </div>
            <div className="auth-right">
                <div className="auth-card" style={{ borderRadius: '12px' }}>
                    <h2>Welcome Back</h2>
                    <p className="auth-subtitle">{brand.subtitle}</p>

                    {error && <div className="auth-error" style={{ borderRadius: '6px' }}>{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {!mfaToken ? (
                            <>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} className="input-icon" style={{ color: emailFocused ? '#E53935' : undefined }} />
                                        <input
                                            type="text"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onFocus={() => setEmailFocused(true)}
                                            onBlur={() => setEmailFocused(false)}
                                            required
                                            style={{
                                                borderRadius: '6px',
                                                borderColor: emailFocused ? '#E53935' : undefined,
                                                boxShadow: emailFocused ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : undefined,
                                                outline: 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Password</label>
                                    <div className="input-wrapper">
                                        <KeyRound size={18} className="input-icon" style={{ color: passwordFocused ? '#E53935' : undefined }} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setPasswordFocused(true)}
                                            onBlur={() => setPasswordFocused(false)}
                                            required
                                            style={{
                                                borderRadius: '6px',
                                                borderColor: passwordFocused ? '#E53935' : undefined,
                                                boxShadow: passwordFocused ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : undefined,
                                                outline: 'none',
                                                transition: 'all 0.2s'
                                            }}
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
                                        <input type="checkbox" style={{ borderRadius: '3px' }} /> Remember me
                                    </label>
                                    <Link to="/forgot-password" className="forgot-password" style={{ color: '#E53935' }}>
                                        Forgot Password?
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="input-group">
                                <label>MFA Authenticator Code</label>
                                <div className="input-wrapper">
                                    <ShieldCheck size={18} className="input-icon" style={{ color: mfaFocused ? '#E53935' : undefined }} />
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value)}
                                        onFocus={() => setMfaFocused(true)}
                                        onBlur={() => setMfaFocused(false)}
                                        required
                                        maxLength={6}
                                        style={{
                                            letterSpacing: '0.5em',
                                            textAlign: 'center',
                                            fontSize: '1.2em',
                                            borderRadius: '6px',
                                            borderColor: mfaFocused ? '#E53935' : undefined,
                                            boxShadow: mfaFocused ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : undefined,
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    />
                                </div>
                                <small style={{ color: '#6b7280', marginTop: '0.5rem', display: 'block' }}>Enter the 6-digit code from your authenticator app</small>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="auth-btn btn-primary"
                            disabled={isSubmitting}
                            style={{
                                background: '#E53935',
                                borderColor: 'transparent',
                                borderRadius: '6px',
                                height: '44px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {isSubmitting ? <LoaderCircle className="spinner" size={18} /> : (mfaToken ? 'Verify Code' : 'Login')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
