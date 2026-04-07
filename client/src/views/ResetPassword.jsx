import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import authService from '../api/authService';
import { KeyRound, Eye, EyeOff, LoaderCircle, CheckCircle2 } from 'lucide-react';
import '../styles.css';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        password: '',
        confirm_password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState(''); // '' | 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const token = searchParams.get("token");
    const email = searchParams.get("email");

    useEffect(() => {
        if (!token || !email) {
            setStatus('error');
            setMessage('Invalid or missing recovery token. Please request a new password reset.');
        }
    }, [token, email]);

    const calculateStrength = (pass) => {
        let score = 0;
        if (pass.length > 7) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;
        return score;
    };
    
    const strength = calculateStrength(formData.password);
    const getStrengthLabels = () => {
        if (formData.password.length === 0) return { label: '', color: 'transparent' };
        if (strength < 2) return { label: 'Weak', color: '#ff4d4f' };
        if (strength === 2) return { label: 'Fair', color: '#faad14' };
        if (strength === 3) return { label: 'Good', color: '#52c41a' };
        return { label: 'Strong', color: '#237804' };
    };
    const { label: strengthLabel, color: strengthColor } = getStrengthLabels();

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('');
        setMessage('');

        if (formData.password !== formData.confirm_password) {
            setStatus('error');
            return setMessage('Passwords do not match');
        }

        setStatus('loading');
        try {
            await authService.resetPassword(email, token, formData.password);
            setStatus('success');
            setMessage('Your password has been successfully reset.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setStatus('error');
            setMessage(err.response?.data?.detail || 'Failed to reset password. The link might be expired.');
        }
    };

    return (
        <div className="auth-container" style={{ justifyContent: 'center' }}>
            <div className="auth-card" style={{ maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src="/logo.jpg" alt="Logo" style={{ height: '40px', marginBottom: '1rem' }} />
                    <h2>Set New Password</h2>
                    <p className="auth-subtitle">Create a strong, secure password for your account.</p>
                </div>

                {status === 'error' && !token && (
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#fef2f2', color: '#991b1b', borderRadius: '8px' }}>
                        <p>{message}</p>
                        <Link to="/forgot-password" style={{ display: 'inline-block', marginTop: '1rem', color: '#991b1b', fontWeight: 600 }}>
                            Request New Link
                        </Link>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>
                        <CheckCircle2 size={48} style={{ margin: '0 auto 1rem', display: 'block' }} />
                        <p style={{ lineHeight: '1.5' }}>{message}</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Redirecting to login...</p>
                    </div>
                )}

                {token && email && status !== 'success' && (
                    <form onSubmit={handleSubmit} className="auth-form">
                        {status === 'error' && <div className="auth-error">{message}</div>}

                        <div className="input-group">
                            <label>New Password</label>
                            <div className="input-wrapper">
                                <KeyRound size={18} className="input-icon" />
                                <input
                                    type={showPassword ? "text" : "password"} name="password" placeholder="••••••••"
                                    value={formData.password} onChange={handleChange} required
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {formData.password && (
                                <div className="password-strength" style={{ marginTop: '0.5rem' }}>
                                    <div className="strength-bars">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="s-bar" style={{ backgroundColor: i < strength ? strengthColor : '#e0e0e0' }} />
                                        ))}
                                    </div>
                                    <span style={{ color: strengthColor, fontSize: '0.75rem' }}>{strengthLabel}</span>
                                </div>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Confirm New Password</label>
                            <div className="input-wrapper">
                                <KeyRound size={18} className="input-icon" />
                                <input
                                    type={showPassword ? "text" : "password"} name="confirm_password" placeholder="••••••••"
                                    value={formData.confirm_password} onChange={handleChange} required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary auth-btn" disabled={status === 'loading' || strength < 3}>
                            {status === 'loading' ? <LoaderCircle className="spinner" size={18} /> : 'Save Password'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                            <Link to="/login" style={{ color: '#6b7280', fontSize: '0.9rem', textDecoration: 'none' }}>&larr; Back to login</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
