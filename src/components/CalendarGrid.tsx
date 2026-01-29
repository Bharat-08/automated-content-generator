import { useMemo, useState } from 'react';
import { type NormalizedPost } from '../utils/normalizePost';

interface CalendarGridProps {
    posts: NormalizedPost[];
    isLoading?: boolean;
    isGeneratingAll?: boolean;
    generatingPostIds?: Set<string>;
    onRegenerateWeek?: (start: Date, end: Date) => void;
    onStop?: () => void;
}

// Icons
const PlatformIcon = ({ platform }: { platform: string }) => {
    switch (platform) {
        case 'LinkedIn':
            return <svg width="12" height="12" viewBox="0 0 24 24" fill="#0a66c2"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>;
        case 'Instagram':
            return <svg width="12" height="12" viewBox="0 0 24 24" fill="url(#ig-grad)"><defs><linearGradient id="ig-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f09433" /><stop offset="25%" stopColor="#e6683c" /><stop offset="50%" stopColor="#dc2743" /><stop offset="75%" stopColor="#cc2366" /><stop offset="100%" stopColor="#bc1888" /></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>;
        case 'YouTube':
            return <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF0000"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>;
        default:
            return <span style={{ fontSize: '10px' }}>{platform[0]}</span>;
    }
}

const CalendarGrid = ({ posts, isLoading, isGeneratingAll, generatingPostIds = new Set(), onRegenerateWeek, onStop }: CalendarGridProps) => {
    const [selectedPost, setSelectedPost] = useState<NormalizedPost | null>(null);

    const monthsToRender = useMemo(() => {
        if (isLoading) {
            const now = new Date();
            return [{ year: now.getFullYear(), month: now.getMonth() }];
        }
        if (posts.length === 0) return [];

        const months = new Map<string, { year: number, month: number }>();
        posts.forEach(post => {
            const d = new Date(post.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!months.has(key)) {
                months.set(key, { year: d.getFullYear(), month: d.getMonth() });
            }
        });

        return Array.from(months.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
    }, [isLoading, posts]);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const getCohortColor = (cohort: string) => {
        const map: Record<string, string> = {
            'Founders': '#4f46e5',
            'Educational': '#3b82f6',
            'Product': '#10b981',
            'Brand': '#8b5cf6',
            'Value': '#f59e0b'
        };
        return map[cohort] || '#52525b';
    };

    return (
        <div style={{
            color: '#e4e4e7',
            fontFamily: "'Inter', sans-serif",
            position: 'relative',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
            width: '100%'
        }}>
            {isGeneratingAll && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(9, 9, 11, 0.8)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid rgba(255, 255, 255, 0.1)',
                        borderTopColor: '#4f46e5',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '16px'
                    }} />
                    <div style={{ color: '#fff', fontWeight: '600', fontSize: '15px' }}>
                        Generating Content Strategy...
                    </div>
                    {onStop && (
                        <button
                            onClick={onStop}
                            style={{
                                marginTop: '24px',
                                padding: '8px 16px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                            }}
                        >
                            Stop Generation
                        </button>
                    )}
                </div>
            )}

            {monthsToRender.map(({ year, month }) => {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

                const allDays = [];
                for (let i = 0; i < startDay; i++) allDays.push(null);
                for (let i = 1; i <= daysInMonth; i++) allDays.push(i);

                while (allDays.length % 7 !== 0) allDays.push(null);

                const weeks = [];
                for (let i = 0; i < allDays.length; i += 7) {
                    weeks.push(allDays.slice(i, i + 7));
                }

                const getPostsForDate = (day: number) => {
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    return posts.filter((post) => post.date === dateString);
                };

                return (
                    <div key={`${year}-${month}`} style={{ width: '100%' }}>
                        <header style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                {monthNames[month]} <span style={{ color: '#71717a' }}>{year}</span>
                            </h3>
                            <div style={{ height: '1px', flex: 1, backgroundColor: '#27272a' }}></div>
                        </header>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '40px repeat(7, 1fr)',
                            backgroundColor: '#18181b',
                            border: '1px solid #27272a',
                            borderBottom: 'none',
                            borderTopLeftRadius: '8px',
                            borderTopRightRadius: '8px'
                        }}>
                            <div style={{ borderRight: '1px solid #27272a' }}></div>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} style={{ padding: '12px 0', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: '#71717a', textTransform: 'uppercase', borderRight: day === 'Sun' ? 'none' : '1px solid #27272a' }}>{day}</div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #27272a', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', overflow: 'hidden' }}>
                            {weeks.map((week, weekIndex) => {
                                const validDays = week.filter(d => d !== null) as number[];
                                const startDate = validDays.length ? new Date(year, month, validDays[0], 0, 0, 0) : new Date();
                                const endDate = validDays.length ? new Date(year, month, validDays[validDays.length - 1], 23, 59, 59) : new Date();

                                return (
                                    <div key={weekIndex} style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)', borderTop: weekIndex > 0 ? '1px solid #27272a' : 'none' }}>
                                        <div style={{ borderRight: '1px solid #27272a', backgroundColor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {onRegenerateWeek && validDays.length > 0 && (
                                                <button onClick={() => onRegenerateWeek(startDate, endDate)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                        {week.map((day, dayIndex) => {
                                            const dailyPosts = day ? getPostsForDate(day) : [];
                                            const isWeekend = dayIndex >= 5;
                                            return (
                                                <div key={dayIndex} style={{ minHeight: '160px', backgroundColor: day ? (isWeekend ? '#121215' : '#09090b') : '#18181b', borderRight: dayIndex < 6 ? '1px solid #27272a' : 'none', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                                    {day && (
                                                        <>
                                                            <div style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: dailyPosts.length ? '#e4e4e7' : '#52525b' }}>{day}</div>
                                                            <div style={{ padding: '0 6px 8px 6px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                                                                {isLoading ? (
                                                                    [1, 2].map(i => (
                                                                        <div key={i} style={{ height: '50px', backgroundColor: 'rgba(39, 39, 42, 0.4)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
                                                                    ))
                                                                ) : (
                                                                    dailyPosts.map(post => (
                                                                        <div key={post.id} onClick={() => setSelectedPost(post)} style={{ backgroundColor: '#18181b', borderRadius: '4px', border: '1px solid #27272a', cursor: 'pointer', position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                                                                            {generatingPostIds.has(post.id) && (
                                                                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(24, 24, 27, 0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="3" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                                                                </div>
                                                                            )}
                                                                            <div style={{ padding: '4px 6px', borderBottom: '1px solid #27272a', backgroundColor: '#202023', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <PlatformIcon platform={post.platform} />
                                                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getCohortColor(post.cohort) }} />
                                                                            </div>
                                                                            <div style={{ padding: '6px', fontSize: '10px', color: '#d4d4d8', lineHeight: '1.4' }}>
                                                                                {generatingPostIds.has(post.id) ? (
                                                                                    <span style={{ opacity: 0.7 }}>Generating...</span>
                                                                                ) : (
                                                                                    post.coreMessage || <span style={{ opacity: 0.5 }}>Pending idea...</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {selectedPost && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setSelectedPost(null)}>
                    <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#202023' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <PlatformIcon platform={selectedPost.platform} />
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#fff' }}>Post Details</h2>
                                    <p style={{ fontSize: '12px', color: '#71717a', margin: '2px 0 0 0' }}>{selectedPost.date} • {selectedPost.platform} {selectedPost.format}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedPost(null)} style={{ background: '#27272a', border: 'none', color: '#a1a1aa', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%' }}>✕</button>
                        </div>
                        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ backgroundColor: '#202023', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                                    <label style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>Cohort</label>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#e4e4e7', marginTop: '4px' }}>{selectedPost.cohort}</div>
                                </div>
                                <div style={{ backgroundColor: '#202023', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                                    <label style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>Funnel</label>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#e4e4e7', marginTop: '4px' }}>{selectedPost.funnel}</div>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>Core Message</label>
                                <div style={{ marginTop: '8px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#93c5fd', borderRadius: '12px', fontSize: '14px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                                    {selectedPost.coreMessage || "Generating insight..."}
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>Structure</label>
                                <div style={{ marginTop: '8px', padding: '16px', backgroundColor: '#09090b', color: '#d4d4d8', borderRadius: '12px', fontSize: '13px', border: '1px solid #27272a', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                                    {selectedPost.postCommunication || "Waiting for content..."}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', backgroundColor: '#202023', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedPost(null)} style={{ padding: '8px 16px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default CalendarGrid;
