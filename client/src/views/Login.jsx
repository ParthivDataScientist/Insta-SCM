import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
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
    const { tenant } = useParams();

    const activeTenant = (tenant === 'insta' || window.location.pathname.includes('/insta')) ? 'insta' : 'gordian';
    const isInsta = activeTenant === 'insta';

    useEffect(() => {
        localStorage.setItem('tenant_id', activeTenant);
    }, [activeTenant]);

    useEffect(() => {
        if (user) {
            navigate('/design');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (isInsta) {
            const interval = setInterval(() => {
                setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
            }, 7000);
            return () => clearInterval(interval);
        }
    }, [isInsta]);

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

    // Branding configuration
    const brand = {
        name: isInsta ? "Insta-Exhibition-Dashboards" : "Gordian",
        subtitle: isInsta ? "Secure access to the tracking management system." : "Unified Supply Chain & Logistics Control",
        logo: isInsta ? (
            <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ height: '32px', width: 'auto' }} />
        ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                }}>G</div>
                <span style={{ fontWeight: '800', fontSize: '1.2rem', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gordian</span>
            </div>
        ),
        leftBg: isInsta 
            ? 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)' 
            : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        leftIllustration: isInsta ? (
            <div className="auth-illustration">
                <h2 key={`title-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].title}</h2>
                <p key={`text-${quoteIndex}`} className="fade-text">{QUOTES[quoteIndex].text}</p>
            </div>
        ) : (
            <div className="auth-illustration" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', zIndex: 2 }}>
                <div style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', width: 'fit-content' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#60a5fa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Next-Gen Multi-Tenant Platform</span>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.2', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 1rem 0' }}>
                    Solve the complexity of supply chain logistics.
                </h1>
                <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '440px', margin: '0 0 1.5rem 0' }}>
                    Gordian streamlines operations, tracks critical assets in real time, and leverages intelligent data models to orchestrate seamless global shipments.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>99.9%</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Uptime SLA</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>10M+</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Tracked Assets</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>&lt; 50ms</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>API Latency</span>
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="auth-container">
            <div className="auth-left" style={{ background: brand.leftBg, position: 'relative', overflow: 'hidden' }}>
                {!isInsta && (
                    <div style={{
                        position: 'absolute',
                        top: '-10%',
                        left: '-10%',
                        width: '50%',
                        height: '50%',
                        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                        filter: 'blur(40px)'
                    }} />
                )}
                <div className="auth-brand" style={{ background: isInsta ? 'white' : 'transparent', padding: isInsta ? '0.5rem 1rem' : '0', border: 'none' }}>
                    {brand.logo}
                    {isInsta && <span className="auth-brand-text">Insta-Exhibition-Dashboards</span>}
                </div>
                {brand.leftIllustration}
            </div>
            <div className="auth-right">
                <div className="auth-card" style={{ borderRadius: isInsta ? '12px' : '16px', boxShadow: isInsta ? undefined : '0 20px 40px rgba(0, 0, 0, 0.08)' }}>
                    <h2>{isInsta ? "Welcome Back" : "Sign In to Gordian"}</h2>
                    <p className="auth-subtitle">{brand.subtitle}</p>

                    {error && <div className="auth-error" style={{ borderRadius: isInsta ? '6px' : '8px' }}>{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {!mfaToken ? (
                            <>
                                <div className="input-group">
                                    <label>Email Address</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} className="input-icon" style={{ color: emailFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined }} />
                                        <input
                                            type="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onFocus={() => setEmailFocused(true)}
                                            onBlur={() => setEmailFocused(false)}
                                            required
                                            style={{
                                                borderRadius: isInsta ? '6px' : '8px',
                                                borderColor: emailFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined,
                                                boxShadow: emailFocused ? (isInsta ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)') : undefined,
                                                outline: 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Password</label>
                                    <div className="input-wrapper">
                                        <KeyRound size={18} className="input-icon" style={{ color: passwordFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined }} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setPasswordFocused(true)}
                                            onBlur={() => setPasswordFocused(false)}
                                            required
                                            style={{
                                                borderRadius: isInsta ? '6px' : '8px',
                                                borderColor: passwordFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined,
                                                boxShadow: passwordFocused ? (isInsta ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)') : undefined,
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
                                        <input type="checkbox" style={{ borderRadius: isInsta ? '3px' : '4px' }} /> Remember me
                                    </label>
                                    <Link to="/forgot-password" className="forgot-password" style={{ color: isInsta ? '#E53935' : '#3b82f6' }}>
                                        Forgot Password?
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="input-group">
                                <label>MFA Authenticator Code</label>
                                <div className="input-wrapper">
                                    <ShieldCheck size={18} className="input-icon" style={{ color: mfaFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined }} />
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
                                            borderRadius: isInsta ? '6px' : '8px',
                                            borderColor: mfaFocused ? (isInsta ? '#E53935' : '#3b82f6') : undefined,
                                            boxShadow: mfaFocused ? (isInsta ? '0 0 0 3px rgba(229, 57, 53, 0.1)' : '0 0 0 3px rgba(59, 130, 246, 0.1)') : undefined,
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
                                background: isInsta ? '#E53935' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                borderColor: 'transparent',
                                borderRadius: isInsta ? '6px' : '8px',
                                height: '44px',
                                boxShadow: isInsta ? undefined : '0 4px 12px rgba(59, 130, 246, 0.25)',
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
