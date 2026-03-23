import { useEffect, useRef, useState } from 'react';
import { useExam } from '../context/ExamContext';
import { useNavigate } from 'react-router-dom';

export function useAntiCheat(customMaxViolation) {
    const { state, endExam, setClientMessage, syncStatus } = useExam();
    const [violationCount, setViolationCount] = useState(0);
    const navigate = useNavigate();
    const lastViolationAtRef = useRef(0);

    const MAX_VIOLATION = Number(customMaxViolation) || 3;

    useEffect(() => {
        // Hanya aktif saat ujian berlangsung
        if (!state.isExamStarted || state.isFinished) return;

        const markViolation = (source) => {
            const now = Date.now();
            if (now - lastViolationAtRef.current < 800) return;
            lastViolationAtRef.current = now;

            setViolationCount((prev) => {
                const newCount = prev + 1;
                syncStatus(!!state.isSuspended, undefined, newCount);
                if (newCount >= MAX_VIOLATION) {
                    setClientMessage(`Batas maksimal pelanggaran tercapai (${MAX_VIOLATION}x). Ujian diakhiri.`, 'danger');
                    endExam().finally(() => navigate('/result'));
                } else {
                    setClientMessage(`Peringatan: terdeteksi meninggalkan halaman ujian (${source}). Pelanggaran ${newCount}/${MAX_VIOLATION}.`, 'warning');
                }
                return newCount;
            });
        };

        // 1. Mencegah Klik Kanan
        const handleContextMenu = (e) => {
            e.preventDefault();
        };

        // 2. Mencegah Keyboard Shortcuts (Ctrl+C, Ctrl+V, F12)
        const handleKeyDown = (e) => {
            if (
                e.keyCode === 123 || // F12 (DevTools)
                (e.ctrlKey && e.keyCode === 67) || // Ctrl+C
                (e.ctrlKey && e.keyCode === 86) || // Ctrl+V
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) // Ctrl+Shift+I
            ) {
                e.preventDefault();
            }
        };

        // 3. Deteksi Pindah Tab / Pindah Aplikasi
        const handleVisibilityChange = () => {
            if (document.hidden) {
                markViolation('tab');
            }
        };

        const handleWindowBlur = () => {
            markViolation('aplikasi');
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [state.isExamStarted, state.isFinished, state.isSuspended, endExam, navigate, MAX_VIOLATION, setClientMessage, syncStatus]);

    return { violationCount, maxViolation: MAX_VIOLATION };
}
