import { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const ExamContext = createContext();

const initialState = {
    isExamStarted: false,
    sessionId: null,
    examId: null,
    examTitle: null,
    allowReview: false,
    questions: [], // Soal yang sudah di-shuffle
    currentIndex: 0,
    answers: {}, // map dari question index -> { optionId, isDoubt }
    timeRemaining: 0,
    isFinished: false,
    isSuspended: false,
    resultAvailable: null,
    finalScores: null,
    submitStatus: 'idle', // idle, submitting, done, error
    saveStatus: 'idle', // idle, saving, saved, error
    lastSavedAt: null,
    lastSaveError: null,
    serverMessage: null, // { message, type, timestamp }
};

function examReducer(state, action) {
    switch (action.type) {
        case 'START_EXAM':
            return {
                ...state,
                isExamStarted: true,
                sessionId: action.payload.sessionId,
                examId: action.payload.examId,
                examTitle: action.payload.examTitle ?? state.examTitle,
                allowReview: false,
                questions: action.payload.questions,
                timeRemaining: action.payload.duration,
                isFinished: false,
                resultAvailable: null,
                finalScores: null,
                submitStatus: 'idle',
                currentIndex: 0,
                answers: action.payload.answers || {},
            };
        case 'SET_ANSWER':
            return {
                ...state,
                answers: {
                    ...state.answers,
                    [state.currentIndex]: {
                        ...state.answers[state.currentIndex],
                        optionId: action.payload,
                    }
                }
            };
        case 'TOGGLE_DOUBT':
            return {
                ...state,
                answers: {
                    ...state.answers,
                    [state.currentIndex]: {
                        ...state.answers[state.currentIndex],
                        isDoubt: !state.answers[state.currentIndex]?.isDoubt,
                    }
                }
            };
        case 'GOTO_QUESTION':
            return { ...state, currentIndex: action.payload };
        case 'NEXT_QUESTION':
            if (state.currentIndex < state.questions.length - 1) {
                return { ...state, currentIndex: state.currentIndex + 1 };
            }
            return state;
        case 'PREV_QUESTION':
            if (state.currentIndex > 0) {
                return { ...state, currentIndex: state.currentIndex - 1 };
            }
            return state;
        case 'TICK_TIMER':
            if (state.isSuspended) return state;
            if (state.timeRemaining <= 1) {
                return { ...state, timeRemaining: 0, isFinished: true };
            }
            return { ...state, timeRemaining: state.timeRemaining - 1 };
        case 'SET_TIME_REMAINING':
            return { ...state, timeRemaining: action.payload };
        case 'SET_SUSPENDED':
            return { ...state, isSuspended: action.payload };
        case 'ADD_TIME':
            return { ...state, timeRemaining: state.timeRemaining + (action.payload * 60) };
        case 'FINISH_EXAM':
            return {
                ...state,
                isExamStarted: true,
                isFinished: true,
                finalScores: action.payload?.scores ?? state.finalScores,
                resultAvailable: action.payload?.resultAvailable ?? state.resultAvailable,
                examId: action.payload?.exam?.id ?? state.examId,
                examTitle: action.payload?.exam?.title ?? state.examTitle,
                allowReview: false,
            };
        case 'SET_SUBMIT_STATUS':
            return { ...state, submitStatus: action.payload };
        case 'SET_SAVE_STATUS':
            return { ...state, saveStatus: action.payload?.status, lastSavedAt: action.payload?.lastSavedAt ?? state.lastSavedAt, lastSaveError: action.payload?.error ?? null };
        case 'SET_SERVER_MESSAGE':
            return { ...state, serverMessage: action.payload };
        case 'RESET_EXAM':
            return initialState;
        default:
            return state;
    }
}

export function ExamProvider({ children }) {
    const [state, dispatch] = useReducer(examReducer, initialState);

    const endExam = async () => {
        if (state.submitStatus === 'submitting') return { success: false };
        if (state.isFinished && state.submitStatus === 'done') return { success: true, scores: state.finalScores, resultAvailable: state.resultAvailable };

        // Reset resultAvailable to null when starting the submission process
        dispatch({ type: 'FINISH_EXAM', payload: { scores: null, resultAvailable: null, exam: { id: state.examId, title: state.examTitle } } });
        dispatch({ type: 'SET_SUBMIT_STATUS', payload: 'submitting' });

        try {
            const token = localStorage.getItem('cat_token');
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/exam/submit`, {
                sessionId: state.sessionId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const resultAvailable = response.data.resultAvailable ?? !!response.data.scores;
            const scores = response.data.scores || null;
            dispatch({ type: 'FINISH_EXAM', payload: { scores, resultAvailable, exam: response.data.exam } });
            dispatch({ type: 'SET_SUBMIT_STATUS', payload: 'done' });
            localStorage.removeItem(`cat_backup_${state.sessionId}`);
            return { success: true, scores, resultAvailable };
        } catch (error) {
            console.error('Failed to submit exam:', error);
            dispatch({ type: 'SET_SUBMIT_STATUS', payload: 'error' });
            return { success: false };
        }
    };

    // Timer Effect
    useEffect(() => {
        let timerId;
        if (state.isExamStarted && !state.isFinished && !state.isSuspended) {
            timerId = setInterval(() => {
                dispatch({ type: 'TICK_TIMER' });
            }, 1000);
        }
        return () => {
            if (timerId) clearInterval(timerId);
        };
    }, [state.isExamStarted, state.isFinished, state.isSuspended]);

    // Auto-finalize when timer ends
    useEffect(() => {
        if (state.isFinished && state.sessionId && state.submitStatus === 'idle') {
            console.log('[ExamContext] Timer ended, auto-submitting...');
            endExam();
        }
    }, [state.isFinished, state.sessionId, state.submitStatus]);

    useEffect(() => {
        if (!state.isExamStarted || state.isFinished || !state.sessionId) return;
        const token = localStorage.getItem('cat_token');
        if (!token) return;

        const intervalId = setInterval(async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/exam/time-sync/${state.sessionId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = res.data;
                if (typeof data.timeRemaining === 'number') dispatch({ type: 'SET_TIME_REMAINING', payload: data.timeRemaining });
                if (typeof data.isSuspended === 'boolean') dispatch({ type: 'SET_SUSPENDED', payload: data.isSuspended });
                if (data.status === 'finished' && !state.isFinished) {
                    dispatch({ type: 'FINISH_EXAM', payload: { scores: null, resultAvailable: data.resultAvailable, exam: { id: state.examId, title: state.examTitle } } });
                    dispatch({ type: 'SET_SUBMIT_STATUS', payload: 'done' });
                }
            } catch (_e) {
                void _e;
            }
        }, 15000);

        return () => clearInterval(intervalId);
    }, [state.isExamStarted, state.isFinished, state.sessionId, state.examId, state.examTitle]);

    // Socket.IO Effect
    useEffect(() => {
        if (!state.isExamStarted || state.isFinished || !state.sessionId) return;

        const token = localStorage.getItem('cat_token');
        const socket = io(import.meta.env.VITE_SOCKET_URL, {
            auth: { token }
        });

        // Get participant ID from context or decode token if needed
        // Assuming the server works with join(participant_id)
        // We'll join room based on sessionId for simplicity or per participant
        socket.on('connect', () => {
            socket.emit('participant_join', {
                sessionId: state.sessionId
            });
            console.log('Socket connected for exam session:', state.sessionId);
        });

        socket.on('SESSION_PAUSED', (data) => {
            dispatch({ type: 'SET_SUSPENDED', payload: true });
            console.log('Exam suspended:', data.reason);
        });

        socket.on('SESSION_RESUMED', () => {
            dispatch({ type: 'SET_SUSPENDED', payload: false });
            console.log('Exam resumed');
        });

        socket.on('TIME_ADDED', (data) => {
            dispatch({ type: 'ADD_TIME', payload: data.minutes });
            console.log('Time added:', data.minutes, 'minutes');
        });

        socket.on('FORCE_LOGOUT', (data) => {
            dispatch({ type: 'SET_SERVER_MESSAGE', payload: { message: data.reason || 'Sesi ujian Anda telah diberhentikan oleh admin.', type: 'danger', timestamp: new Date().toISOString() } });
            endExam();
        });

        socket.on('SERVER_MESSAGE', (data) => {
            dispatch({ type: 'SET_SERVER_MESSAGE', payload: data });
            console.log('Server broadcast received:', data);
        });

        return () => {
            socket.disconnect();
        };
    }, [state.isExamStarted, state.isFinished, state.sessionId]);

    // Local Storage Backup Effect
    useEffect(() => {
        if (state.isExamStarted && !state.isFinished && state.sessionId) {
            localStorage.setItem(`cat_backup_${state.sessionId}`, JSON.stringify({
                answers: state.answers,
                lastUpdate: Date.now()
            }));
        }
    }, [state.answers, state.isExamStarted, state.isFinished, state.sessionId]);

    const startExam = async () => {
        try {
            const token = localStorage.getItem('cat_token');
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/exam/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data;

            if (data.isFinished) {
                dispatch({ type: 'FINISH_EXAM', payload: { scores: data.scores || null, resultAvailable: data.resultAvailable ?? !!data.scores, exam: data.exam } });
                dispatch({ type: 'SET_SUBMIT_STATUS', payload: 'done' });
                return { success: true, isFinished: true };
            }

            // Opsional: Coba shuffle ulang di frontend jika butuh
            // CATATAN: Karena kita merestore jawaban, urutan soal tetap diacak, 
            // namun kita harus mapping savedAnswers (berdasarkan question_id) ke index state
            const shuffledQuestions = data.questions;

            // Reconstruct saved answers from DB
            let restoredAnswers = {};
            if (data.savedAnswers && data.savedAnswers.length > 0) {
                shuffledQuestions.forEach((q, idx) => {
                    const foundAns = data.savedAnswers.find(ans => ans.question_id === q.id);
                    if (foundAns && foundAns.selected_option_id) {
                        restoredAnswers[idx] = {
                            optionId: foundAns.selected_option_id,
                            isDoubt: Boolean(foundAns.is_doubt)
                        };
                    }
                });
            }

            // LocalStorage Fallback (Jika data lokal lebih baru/ada)
            const backupStr = localStorage.getItem(`cat_backup_${data.sessionId}`);
            if (backupStr) {
                try {
                    const backup = JSON.parse(backupStr);
                    // Gabungkan answers, utamakan yang ada di backup jika data DB kosong
                    restoredAnswers = { ...restoredAnswers, ...backup.answers };
                } catch (e) {
                    console.error('Backup restore failed', e);
                }
            }

            dispatch({
                type: 'START_EXAM',
                payload: {
                    sessionId: data.sessionId,
                    examId: data.examId || data.exam_id,
                    examTitle: data.exam?.title,
                    allowReview: data.exam?.allowReview,
                    questions: shuffledQuestions,
                    duration: data.timeRemaining,
                    answers: restoredAnswers
                }
            });
            if (data.isSuspended) {
                dispatch({ type: 'SET_SUSPENDED', payload: true });
            }
            return { success: true, isFinished: data.isFinished };
        } catch (error) {
            console.error('Failed to start exam:', error.response?.data || error);
            const msg = error.response?.data?.error || 'Gagal terhubung ke server Ujian';
            return { success: false, message: msg };
        }
    };

    const resetExam = () => dispatch({ type: 'RESET_EXAM' });

    const setAnswer = async (optionId) => {
        console.log('[ExamContext] setAnswer called with optionId:', optionId);
        dispatch({ type: 'SET_ANSWER', payload: optionId });
        // Autosave ke server
        try {
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'saving' } });
            const token = localStorage.getItem('cat_token');
            const questionId = state.questions[state.currentIndex].id;
            await axios.post(`${import.meta.env.VITE_API_URL}/api/exam/answer`, {
                sessionId: state.sessionId,
                questionId: questionId,
                selectedOptionId: optionId,
                isDoubt: state.answers[state.currentIndex]?.isDoubt || false
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'saved', lastSavedAt: Date.now() } });
        } catch (error) {
            console.error('Autosave failed:', error);
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'error', error: error?.response?.data?.error || 'Autosave gagal' } });
        }
    };

    const toggleDoubt = async () => {
        dispatch({ type: 'TOGGLE_DOUBT' });
        // Autosave status ragu-ragu
        try {
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'saving' } });
            const token = localStorage.getItem('cat_token');
            const questionId = state.questions[state.currentIndex].id;
            const currentAnswer = state.answers[state.currentIndex];
            const newDoubtStatus = !currentAnswer?.isDoubt;
            await axios.post(`${import.meta.env.VITE_API_URL}/api/exam/answer`, {
                sessionId: state.sessionId,
                questionId: questionId,
                selectedOptionId: currentAnswer?.optionId || null,
                isDoubt: newDoubtStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'saved', lastSavedAt: Date.now() } });
        } catch (error) {
            console.error('Autosave doubt failed:', error);
            dispatch({ type: 'SET_SAVE_STATUS', payload: { status: 'error', error: error?.response?.data?.error || 'Autosave gagal' } });
        }
    };
    const goToQuestion = (index) => dispatch({ type: 'GOTO_QUESTION', payload: index });
    const nextQuestion = () => dispatch({ type: 'NEXT_QUESTION' });
    const prevQuestion = () => dispatch({ type: 'PREV_QUESTION' });
    const acknowledgeMessage = () => dispatch({ type: 'SET_SERVER_MESSAGE', payload: null });
    const setClientMessage = (message, type = 'info') => dispatch({ type: 'SET_SERVER_MESSAGE', payload: { message, type, timestamp: new Date().toISOString() } });

    const syncStatus = async (isSuspended, fsViolations, tabViolations) => {
        if (!state.sessionId) return;
        try {
            const token = localStorage.getItem('cat_token');
            await axios.post(`${import.meta.env.VITE_API_URL}/api/exam/status/sync`, {
                sessionId: state.sessionId,
                isSuspended,
                fsViolations,
                tabViolations
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            dispatch({ type: 'SET_SUSPENDED', payload: isSuspended });
        } catch (error) {
            console.error('Failed to sync status:', error);
        }
    };

    const value = {
        state,
        startExam,
        endExam,
        resetExam,
        setAnswer,
        toggleDoubt,
        goToQuestion,
        nextQuestion,
        prevQuestion,
        acknowledgeMessage,
        setClientMessage,
        syncStatus
    };

    return (
        <ExamContext.Provider value={value}>
            {children}
        </ExamContext.Provider>
    );
}

export const useExam = () => useContext(ExamContext);
