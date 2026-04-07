import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../api/authService';
import { Mail, LoaderCircle, CheckCircle2 } from 'lucide-react';
import '../styles.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState(''); // '' | 'loading' | 'success' | 'error'
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        try {
            const res = await authService.forgotPassword(email);
            setMessage(res.message);
            setStatus('success');
        } catch (err) {
            // Display standard message regardless of real error to prevent enumeration
            setMessage("If that email is in our system, a reset link will be sent.");
            setStatus('success');
        }
    };

    return (
        <div className="auth-container" style={{ justifyContent: 'center' }}>
            <div className="auth-card" style={{ maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src="/logo.jpg" alt="Logo" style={{ height: '40px', marginBottom: '1rem' }} />
                    <h2>Password Recovery</h2>
                    <p className="auth-subtitle">Enter your email to receive recovery instructions.</p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', color: '#166534', borderRadius: '8px' }}>
                        <CheckCircle2 size={48} style={{ margin: '0 auto 1rem', display: 'block' }} />
                        <p style={{ lineHeight: '1.5' }}>{message}</p>
                        <Link to="/login" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#15803d', fontWeight: 600, textDecoration: 'none' }}>
                            &larr; Return to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    placeholder="Enter your corporate email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary auth-btn" disabled={status === 'loading'}>
                            {status === 'loading' ? <LoaderCircle className="spinner" size={18} /> : 'Send Reset Link'}
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

export default ForgotPassword;
