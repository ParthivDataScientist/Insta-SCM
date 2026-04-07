import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, KeyRound, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import '../styles.css';

const QUOTES = [
    { title: "Empower Your Logistics", text: "Streamlining exhibitions and tracking with precision and efficiency." },
    { title: "Data-Driven Decisions", text: "Real-time monitoring for your most critical business assets." },
    { title: "Seamless Operations", text: "Connecting teams, shipments, and projects across the globe." },
    { title: "Excellence in Execution", text: "Delivering flawless exhibition experiences through robust tracking." },
];

const Register = () => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirm_password: '',
        role: 'Operator',
        tos_accepted: false
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const { register } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
        }, 7000);
        return () => clearInterval(interval);
    }, []);

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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirm_password) {
            return setError("Passwords do not match");
        }

        setIsSubmitting(true);
        try {
            await register(formData);
            setSuccess("Account created successfully. Redirecting to login...");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message || 'Registration failed');
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
                <div className="auth-card register-card">
                    <h2>Create Account</h2>
                    <p className="auth-subtitle">Register to manage supply chain and exhibition logistics.</p>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="input-group">
                            <label>Full Name</label>
                            <div className="input-wrapper">
                                <User size={18} className="input-icon" />
                                <input
                                    type="text" name="full_name" placeholder="John Doe"
                                    value={formData.full_name} onChange={handleChange} required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email" name="email" placeholder="john@example.com"
                                    value={formData.email} onChange={handleChange} required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Password</label>
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
                                <div className="password-strength">
                                    <div className="strength-bars">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="s-bar" style={{ backgroundColor: i < strength ? strengthColor : '#e0e0e0' }} />
                                        ))}
                                    </div>
                                    <span style={{ color: strengthColor }}>{strengthLabel}</span>
                                </div>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <KeyRound size={18} className="input-icon" />
                                <input
                                    type={showPassword ? "text" : "password"} name="confirm_password" placeholder="••••••••"
                                    value={formData.confirm_password} onChange={handleChange} required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Company Role</label>
                            <div className="input-wrapper">
                                <ShieldCheck size={18} className="input-icon" />
                                <select 
                                    name="role" 
                                    value={formData.role} 
                                    onChange={handleChange} 
                                    required 
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '0.5rem 0' }}
                                >
                                    <option value="Operator">Operator</option>
                                    <option value="Dispatcher">Dispatcher</option>
                                    <option value="Fleet Manager">Fleet Manager</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                        </div>


                        <div className="auth-actions" style={{ justifyContent: 'flex-start' }}>
                            <label className="remember-me">
                                <input type="checkbox" name="tos_accepted" checked={formData.tos_accepted} onChange={handleChange} required /> I agree to the <a href="#">Terms & Conditions</a>
                            </label>
                        </div>

                        <button type="submit" className="btn-primary auth-btn" disabled={isSubmitting}>
                            {isSubmitting ? <LoaderCircle className="spinner" size={18} /> : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
