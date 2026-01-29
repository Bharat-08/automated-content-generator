import React, { useMemo } from 'react';
import { type NormalizedPost } from '../utils/normalizePost';

interface ListViewProps {
    posts: NormalizedPost[];
    isLoading?: boolean;
    onRegenerateWeek?: (start: Date, end: Date) => void;
    isGeneratingAll?: boolean;
    generatingPostIds?: Set<string>;
    onStop?: () => void;
    regeneratingWeek?: { start: Date; end: Date } | null;
    onUpdatePost?: (id: string, updates: Partial<NormalizedPost>) => void;
    isEditing?: boolean;
}

// Reusable Badge Component
const Badge = ({ children, color, style = {} }: { children: React.ReactNode, color: string, style?: React.CSSProperties }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: `${color}15`, // 15% opacity
        color: color,
        border: `1px solid ${color}30`,
        fontSize: '11px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        ...style
    }}>
        {children}
    </span>
);

const AutoResizingTextarea = ({
    value,
    onChange,
    placeholder,
    style = {}
}: {
    value: string,
    onChange: (val: string) => void,
    placeholder?: string,
    style?: React.CSSProperties
}) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={1}
            style={{
                width: '100%',
                backgroundColor: 'transparent',
                color: 'inherit',
                border: '1px solid transparent',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                resize: 'none',
                outline: 'none',
                overflow: 'hidden',
                transition: 'border-color 0.2s, background-color 0.2s',
                ...style
            }}
            onFocus={(e) => {
                e.target.style.borderColor = '#3f3f46';
                e.target.style.backgroundColor = '#18181b';
            }}
            onBlur={(e) => {
                e.target.style.borderColor = 'transparent';
                e.target.style.backgroundColor = 'transparent';
            }}
        />
    );
};


const ListView = ({
    posts,
    isLoading,
    onRegenerateWeek,
    isGeneratingAll,
    generatingPostIds = new Set(),
    onStop,
    regeneratingWeek,
    onUpdatePost,
    isEditing
}: ListViewProps) => {

    const postsByWeek = useMemo(() => {
        const groups: Record<string, NormalizedPost[]> = {};
        posts.forEach(post => {
            const d = new Date(post.date);
            const day = d.getDay() || 7;
            const start = new Date(d);
            start.setHours(0, 0, 0, 0);
            start.setDate(d.getDate() - day + 1);
            const key = start.toISOString().split('T')[0];

            if (!groups[key]) groups[key] = [];
            groups[key].push(post);
        });
        return Object.keys(groups).sort().reduce((obj, key) => {
            obj[key] = groups[key];
            return obj;
        }, {} as Record<string, NormalizedPost[]>);
    }, [posts]);

    const getPlatformColor = (p: string) => {
        switch (p) {
            case 'LinkedIn': return '#0a66c2';
            case 'Instagram': return '#e1306c';
            case 'YouTube': return '#ff0000';
            default: return '#71717a';
        }
    }

    const getCohortColor = (c: string) => {
        const map: Record<string, string> = {
            'Educational': '#3b82f6',
            'Product': '#10b981',
            'Brand': '#8b5cf6',
            'Value': '#f59e0b',
            'Founders': '#6366f1'
        };
        return map[c] || '#71717a';
    }

    return (
        <div style={{
            color: '#e4e4e7',
            fontFamily: "'Inter', sans-serif",
            width: '100%',
            border: '1px solid #27272a',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#09090b',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            position: 'relative'
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
                    justifyContent: 'center'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid rgba(255, 255, 255, 0.1)',
                        borderTopColor: '#4f46e5',
                        borderRadius: '50%',
                        animation: 'listViewOverlaySpin 1s linear infinite',
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
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                        >
                            Stop Generation
                        </button>
                    )}
                </div>
            )}
            <div style={{
                maxHeight: '75vh',
                overflowY: 'auto',
                opacity: isGeneratingAll ? 0.7 : 1,
                scrollbarWidth: 'thin'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#09090b', boxShadow: '0 1px 0 #27272a' }}>
                        <tr>
                            <th style={{ width: '85px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Date</th>
                            <th style={{ width: '90px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Funnel</th>
                            <th style={{ width: '90px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Cohort</th>
                            <th style={{ width: '90px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Pillar</th>
                            <th style={{ width: '80px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Format</th>
                            <th style={{ width: '220px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Core Message</th>
                            <th style={{ padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Communication</th>
                            <th style={{ width: '80px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase' }}>Platform</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <tr key={i} style={{ borderBottom: '1px solid #18181b' }}>
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} style={{ padding: '16px 12px' }}>
                                            <div style={{ height: '14px', backgroundColor: 'rgba(39, 39, 42, 0.4)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            Object.entries(postsByWeek).map(([weekKey, weekPosts]) => {
                                const firstDate = new Date(weekPosts[0].date);
                                const day = firstDate.getDay() || 7;
                                const start = new Date(firstDate);
                                start.setDate(firstDate.getDate() - day + 1);
                                const end = new Date(start);
                                end.setDate(start.getDate() + 6);
                                start.setHours(0, 0, 0, 0);
                                end.setHours(23, 59, 59, 999);

                                return (
                                    <React.Fragment key={weekKey}>
                                        <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid #27272a', borderTop: '1px solid #27272a' }}>
                                            <td colSpan={8} style={{ padding: '8px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#e4e4e7', textTransform: 'uppercase' }}>
                                                        Week of {start.toLocaleDateString()}
                                                    </span>
                                                    {onRegenerateWeek && (
                                                        <button
                                                            onClick={() => onRegenerateWeek(start, end)}
                                                            disabled={!!regeneratingWeek}
                                                            style={{ background: 'transparent', border: '1px solid #3f3f46', borderRadius: '4px', color: '#a1a1aa', padding: '4px 8px', fontSize: '10px', cursor: (regeneratingWeek) ? 'not-allowed' : 'pointer' }}
                                                        >
                                                            {regeneratingWeek && regeneratingWeek.start.getTime() === start.getTime() ? 'Regenerating...' : 'Regenerate Week'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {weekPosts.map((post, idx) => {
                                            const isRegenerating = generatingPostIds.has(post.id);
                                            const rowBg = idx % 2 === 0 ? 'transparent' : '#121215';
                                            return (
                                                <tr key={post.id} style={{ backgroundColor: rowBg, borderBottom: '1px solid #1f1f22', fontSize: '12px', verticalAlign: 'top' }}>
                                                    <td style={{ padding: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{post.date}</td>
                                                    <td style={{ padding: '12px', color: '#d4d4d8' }}>{post.funnel}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getCohortColor(post.cohort) }} />
                                                            <span style={{ color: '#e4e4e7' }}>{post.cohort}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', color: '#a1a1aa' }}>{post.boatPillar}</td>
                                                    <td style={{ padding: '12px', color: '#a1a1aa' }}>{post.format}</td>
                                                    <td style={{ padding: '12px', color: '#a1a1aa', lineHeight: '1.5' }}>
                                                        {isRegenerating ? (
                                                            <span style={{ color: '#4f46e5' }}>Generating...</span>
                                                        ) : isEditing ? (
                                                            <AutoResizingTextarea
                                                                value={post.coreMessage}
                                                                onChange={(val) => onUpdatePost?.(post.id, { coreMessage: val })}
                                                            />
                                                        ) : (
                                                            post.coreMessage
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px', color: '#e4e4e7', fontWeight: '500', lineHeight: '1.5' }}>
                                                        {isRegenerating ? (
                                                            <span style={{ color: '#4f46e5' }}>Generating...</span>
                                                        ) : isEditing ? (
                                                            <AutoResizingTextarea
                                                                value={post.postCommunication}
                                                                onChange={(val) => onUpdatePost?.(post.id, { postCommunication: val })}
                                                            />
                                                        ) : (
                                                            post.postCommunication
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <Badge color={getPlatformColor(post.platform as string)}>{post.platform}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <style>{`
                @keyframes listViewOverlaySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
            `}</style>
        </div>
    );
};

export default ListView;
