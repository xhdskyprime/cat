import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const API_URL = `${import.meta.env.VITE_API_URL}/api`;

    // Cek sesi berjalan di memori lokal (jika reload page)
    useEffect(() => {
        const token = localStorage.getItem('cat_token');
        const savedUser = localStorage.getItem('cat_user');

        if (token && savedUser) {
            setUser(JSON.parse(savedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setLoading(false);
    }, []);

    const login = async (nik, nomorPeserta, tokenStr) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                nik,
                nomorPeserta,
                token: tokenStr
            });

            // Simpan Ke LocalStorage
            const exam = response.data.exam || {};
            const userData = { ...(response.data.user || {}), examId: exam.id, examTitle: exam.title };
            const authToken = response.data.token;

            localStorage.setItem('cat_token', authToken);
            localStorage.setItem('cat_user', JSON.stringify(userData));

            // Set header default
            axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

            setUser(userData);
            return {
                success: true,
                hasFinished: response.data.hasFinished,
                hasActiveSession: response.data.hasActiveSession
            };
        } catch (error) {
            const msg = error.response?.data?.error || 'Koneksi ke server gagal.';
            return { success: false, message: msg };
        }
    };

    const logout = () => {
        localStorage.removeItem('cat_token');
        localStorage.removeItem('cat_user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    if (loading) return null; // Blink protection prevent redirect loops

    return (
        <AuthContext.Provider value={{ user, login, logout, API_URL }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
