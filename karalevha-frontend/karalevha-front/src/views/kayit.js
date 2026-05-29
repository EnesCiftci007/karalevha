import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Kayit = () => {
    const [formData, setFormData] = useState({
        display_name: '',
        email: '',
        password: ''
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        try {
            const response = await fetch('http://localhost:8000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Kayıt başarıyla tamamlandı!');
                setFormData({ display_name: '', email: '', password: '' });
            } else {
                setError(data.detail || 'Bir hata oluştu.');
            }
        } catch (err) {
            setError('Backend sunucusuna bağlanılamadı. Motorun açık olduğundan emin ol!');
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>🖤 Karalevha'ya Katıl</h2>
                <p style={styles.subtitle}>Kendi üretim dünyanı yönetmeye hazır mısın?</p>

                {message && <div style={styles.successBox}>{message}</div>}
                {error && <div style={styles.errorBox}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Görünür İsim (Forum için)</label>
                        <input
                            type="text"
                            name="display_name"
                            value={formData.display_name}
                            onChange={handleChange}
                            placeholder="Örn: MakerFatih"
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>E-Posta Adresi</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="fatih@example.com"
                            required
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Şifre</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            style={styles.input}
                        />
                    </div>

                    <button type="submit" style={styles.buttonKayit}>Macerayı Başlat</button>

                    <p style={{ marginTop: '20px', fontSize: '14px', color: '#aaa' }}>
                        Zaten üye misin? <Link to="/giris" style={{ color: '#2ed573', textDecoration: 'none', fontWeight: 'bold' }}>Giriş Yap</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

// Hata veren stiller buraya eksiksiz eklendi
const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'Arial, sans-serif' },
    card: { backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px', textAlign: 'center' },
    title: { margin: '0 0 10px 0', fontSize: '26px', fontWeight: 'bold' },
    subtitle: { color: '#aaa', fontSize: '14px', marginBottom: '30px' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    inputGroup: { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '8px' },
    label: { fontSize: '13px', color: '#ccc', fontWeight: '500' },
    input: { padding: '12px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '15px', outline: 'none' },
    buttonKayit: { padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#ff4757', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
    buttonGiris: { padding: '14px', borderRadius: '6px', border: 'none', backgroundColor: '#2ed573', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
    successBox: { backgroundColor: '#2ed573', color: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' },
    errorBox: { backgroundColor: '#ff4757', color: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }
};

export default Kayit;