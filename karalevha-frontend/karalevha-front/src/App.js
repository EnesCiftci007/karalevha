import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AnaSayfa from './views/AnaSayfa';
import BaskiDukkani from './views/BaskiDukkani';

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Karalevha Ana Sayfa Vitrini */}
                <Route path="/" element={
                    <MainLayout>
                        <AnaSayfa />
                    </MainLayout>
                } />

                {/* 3D Baský Analiz ve Sipariþ Motoru */}
                <Route path="/baski" element={
                    <MainLayout>
                        <BaskiDukkani />
                    </MainLayout>
                } />

                {/* Gizli Admin Giriþ Yolu */}
                <Route path="/admin" element={
                    <MainLayout>
                        <BaskiDukkani />
                    </MainLayout>
                } />
            </Routes>
        </Router>
    );
}