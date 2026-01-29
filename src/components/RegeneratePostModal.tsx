import React, { useState, useEffect } from 'react';

interface RegeneratePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (instruction: string) => void;
    postDate: string;
    platform: string;
}

const RegeneratePostModal: React.FC<RegeneratePostModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    postDate,
    platform
}) => {
    const [instruction, setInstruction] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInstruction('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '500px',
                backgroundColor: '#18181b',
                borderRadius: '16px',
                border: '1px solid #27272a',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', backgroundColor: '#202023' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#fff' }}>Regenerate Post</h2>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '4px 0 0 0' }}>
                        {platform} • {new Date(postDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#d4d4d8' }}>
                            Regeneration Instruction (Optional)
                        </label>
                        <textarea
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="e.g., Make it punchier, use more emojis, focus on features..."
                            rows={4}
                            style={{
                                padding: '12px',
                                backgroundColor: '#27272a',
                                color: '#fff',
                                border: '1px solid #3f3f46',
                                borderRadius: '8px',
                                fontSize: '14px',
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', backgroundColor: '#202023', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 16px',
                            backgroundColor: 'transparent',
                            color: '#a1a1aa',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(instruction)}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '700'
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegeneratePostModal;
