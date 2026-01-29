import React, { useState, useEffect } from 'react';
import { type CohortType, GOAL_COHORT_DISTRIBUTION } from '../utils/goalToCohort';
import { type PrimaryGoal } from '../utils/platformFrequency';

interface RegenerateWeekModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { mix: Record<CohortType, number>; instruction: string }) => void;
    startDate: Date;
    endDate: Date;
    primaryGoal: PrimaryGoal;
}

const RegenerateWeekModal: React.FC<RegenerateWeekModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    startDate,
    endDate,
    primaryGoal
}) => {
    const [instruction, setInstruction] = useState('');
    const [mix, setMix] = useState<Record<CohortType, number>>(() => ({ ...GOAL_COHORT_DISTRIBUTION[primaryGoal] }));

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setInstruction('');
            setMix({ ...GOAL_COHORT_DISTRIBUTION[primaryGoal] });
        }
    }, [isOpen, primaryGoal]);

    if (!isOpen) return null;

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleMixChange = (cohort: CohortType, newValue: number) => {
        setMix(prev => {
            const oldMix = { ...prev };
            // SMART BALANCING LOGIC
            // 1. Calculate how much we need to distribute to others
            const targetRemainder = 100 - newValue;
            const otherKeys = (Object.keys(oldMix) as CohortType[]).filter(k => k !== cohort);

            // 2. Calculate current total of others
            const currentOtherTotal = otherKeys.reduce((sum, key) => sum + oldMix[key], 0);

            const newMix = { ...oldMix, [cohort]: newValue };

            if (currentOtherTotal === 0) {
                // Edge case: Others were 0, distribute remainder equally
                if (targetRemainder > 0) {
                    const split = targetRemainder / otherKeys.length;
                    otherKeys.forEach(k => newMix[k] = split);
                }
            } else {
                // 3. Proportional reduction/increase
                const ratio = targetRemainder / currentOtherTotal;
                otherKeys.forEach(k => {
                    newMix[k] = oldMix[k] * ratio;
                });
            }

            // 4. Rounding cleanup to ensure exact 100
            let roundedSum = 0;
            let maxOtherKey = otherKeys[0];

            otherKeys.forEach(k => {
                newMix[k] = Math.round(newMix[k]);
                if (newMix[k] > (newMix[maxOtherKey] || 0)) maxOtherKey = k;
                roundedSum += newMix[k];
            });

            const finalDust = 100 - (newValue + roundedSum);
            if (finalDust !== 0 && maxOtherKey) {
                newMix[maxOtherKey] += finalDust;
            }

            return newMix;
        });
    };

    const total = Object.values(mix).reduce((a, b) => a + b, 0);

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
                    <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#fff' }}>Regenerate Week</h2>
                    <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '4px 0 0 0' }}>
                        {formatDate(startDate)} - {formatDate(endDate)}
                    </p>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Rebalance Cohort Mix</label>
                            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>Balanced: {total}%</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#27272a', padding: '16px', borderRadius: '12px' }}>
                            {(Object.keys(mix) as CohortType[]).map((cohort) => (
                                <div key={cohort} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                        <span style={{ color: '#a1a1aa', fontWeight: '600' }}>{cohort}</span>
                                        <span style={{ color: '#fff' }}>{mix[cohort]}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={mix[cohort]}
                                        onChange={(e) => handleMixChange(cohort, parseInt(e.target.value))}
                                        style={{ width: '100%', accentColor: '#4f46e5', cursor: 'pointer' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Instructions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                            Custom Refinement (Optional)
                        </label>
                        <textarea
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="e.g., Focus on soft-selling, make it more humorous, or emphasize the new product launch..."
                            rows={3}
                            style={{
                                padding: '12px',
                                backgroundColor: '#27272a',
                                color: '#fff',
                                border: '1px solid #3f3f46',
                                borderRadius: '8px',
                                fontSize: '14px',
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                            onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', backgroundColor: '#202023', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm({ mix, instruction })}
                        style={{
                            padding: '10px 24px',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '700',
                            transition: 'all 0.2s'
                        }}
                    >
                        Confirm Regeneration
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegenerateWeekModal;
