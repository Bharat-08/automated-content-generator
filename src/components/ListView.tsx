import { type NormalizedPost } from '../utils/normalizePost';

interface ListViewProps {
    posts: NormalizedPost[];
    onRegenerate?: (postId: string) => void;
    isGeneratingAll?: boolean;
    generatingPostIds?: Set<string>;
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

const Spinner = ({ size = 12, color = '#a1a1aa' }) => (
    <div style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid ${color}`,
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'listViewSpin 0.8s linear infinite',
        display: 'inline-block'
    }}>
        <style>{`
            @keyframes listViewSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
    </div>
);

const ListView = ({ posts, onRegenerate, isGeneratingAll, generatingPostIds = new Set() }: ListViewProps) => {

    // Helper colors
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
            'Educational': '#3b82f6', // blue
            'Product': '#10b981', // green
            'Brand': '#8b5cf6', // purple
            'Community': '#f59e0b', // amber
            'Founders': '#6366f1' // indigo
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
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{
                maxHeight: '75vh', // Taller viewport
                overflowY: 'auto',
                opacity: isGeneratingAll ? 0.7 : 1,
                pointerEvents: isGeneratingAll ? 'none' : 'auto',
                transition: 'opacity 0.2s',
                scrollbarWidth: 'thin',
                scrollbarColor: '#3f3f46 #18181b'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#09090b', boxShadow: '0 1px 0 #27272a' }}>
                        <tr>
                            <th style={{ width: '90px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Funnel</th>
                            <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cohort</th>
                            <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pillar</th>
                            <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Format</th>
                            <th style={{ padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Core Message</th>
                            <th style={{ padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Communication</th>
                            <th style={{ width: '100px', padding: '12px', fontSize: '11px', fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</th>
                            <th style={{ width: '50px', padding: '12px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((post, idx) => {
                            const isRegenerating = generatingPostIds.has(post.id);
                            const rowBg = idx % 2 === 0 ? 'transparent' : '#121215'; // Zebra striping

                            return (
                                <tr
                                    key={post.id}
                                    style={{
                                        backgroundColor: rowBg,
                                        borderBottom: '1px solid #1f1f22',
                                        fontSize: '12px', // Slightly uniform font size
                                        verticalAlign: 'top', // Top align for wrapping text
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e1e22'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                                >
                                    {/* 1. Date */}
                                    <td style={{ padding: '12px', color: '#a1a1aa', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                        {post.date}
                                    </td>

                                    {/* 2. Funnel */}
                                    <td style={{ padding: '12px', color: '#d4d4d8' }}>
                                        {post.funnel}
                                    </td>

                                    {/* 3. Cohort */}
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getCohortColor(post.cohort) }} />
                                            <span style={{ color: '#e4e4e7' }}>{post.cohort}</span>
                                        </div>
                                    </td>

                                    {/* 4. Pillar */}
                                    <td style={{ padding: '12px', color: '#a1a1aa' }}>
                                        {post.boatPillar}
                                    </td>

                                    {/* 5. Format */}
                                    <td style={{ padding: '12px', color: '#a1a1aa' }}>
                                        {post.format}
                                    </td>

                                    {/* 6. Core Message - Flexible */}
                                    <td style={{ padding: '12px', color: '#a1a1aa', lineHeight: '1.5' }}>
                                        {post.coreMessage || '-'}
                                    </td>

                                    {/* 7. Post Communication - Flexible */}
                                    <td style={{ padding: '12px', color: '#e4e4e7', fontWeight: '500', lineHeight: '1.5' }}>
                                        {post.postCommunication || <span style={{ color: '#52525b', fontStyle: 'italic' }}>Generating...</span>}
                                    </td>

                                    {/* 8. Platform */}
                                    <td style={{ padding: '12px' }}>
                                        <Badge color={getPlatformColor(post.platform as string)}>{post.platform}</Badge>
                                    </td>

                                    {/* 9. Actions */}
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => onRegenerate?.(post.id)}
                                            disabled={isRegenerating || isGeneratingAll}
                                            title="Regenerate this post"
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid #27272a',
                                                color: '#a1a1aa',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '4px',
                                                cursor: (isRegenerating || isGeneratingAll) ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isRegenerating && !isGeneratingAll) {
                                                    e.currentTarget.style.borderColor = '#52525b';
                                                    e.currentTarget.style.backgroundColor = '#27272a';
                                                    e.currentTarget.style.color = '#fff';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isRegenerating && !isGeneratingAll) {
                                                    e.currentTarget.style.borderColor = '#27272a';
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = '#a1a1aa';
                                                }
                                            }}
                                        >
                                            {isRegenerating ? <Spinner /> : '↻'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ListView;
