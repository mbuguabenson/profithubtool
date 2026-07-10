import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useDomainLoaderConfig } from '../useDomainLoaderConfig';
import { useLoaderProgress } from '../useLoaderProgress';
import './DomainPreloader.scss';

interface DomainPreloaderProps {
    appReady?: boolean;
    disableSessionReduction?: boolean;
    minimumDuration?: number;
    maximumDuration?: number;
    onComplete: () => void;
}

export const DomainPreloader: React.FC<DomainPreloaderProps> = ({
    appReady = false,
    disableSessionReduction = false,
    minimumDuration = 6000,
    maximumDuration = 15000,
    onComplete,
}) => {
    const config = useDomainLoaderConfig();
    const [isExiting, setIsExiting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);
    const completionFiredRef = useRef(false);

    // AI neural connections
    const neuralNodes = useMemo(() => {
        return Array.from({ length: 15 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 2,
            delay: Math.random() * 5,
        }));
    }, []);

    // Side floating panels data
    const floatingPanels = [
        { id: 1, label: 'EURUSD', value: '76% BUY', type: 'success', class: 'panel-top-left' },
        { id: 2, label: 'Volatility 75', value: 'WAIT', type: 'warning', class: 'panel-mid-right' },
        { id: 3, label: 'Crash 1000', value: 'STRONG BUY', type: 'success', class: 'panel-bottom-left' },
        { id: 4, label: 'Boom 500', value: 'AI SCANNING', type: 'info', class: 'panel-top-right' },
    ];

    const { progress } = useLoaderProgress({
        appReady: appReady,
        minimumDuration: minimumDuration,
        maximumDuration: maximumDuration,
    });

    // Update status text based on progress thresholds
    useEffect(() => {
        if (progress < 20) setStatusIndex(0);
        else if (progress < 40) setStatusIndex(1);
        else if (progress < 60) setStatusIndex(2);
        else if (progress < 80) setStatusIndex(3);
        else setStatusIndex(4);
    }, [progress]);

    // Handle scroll locking
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.width = originalWidth;
        };
    }, []);

    // Handle completion
    useEffect(() => {
        if (progress >= 100 && !completionFiredRef.current) {
            completionFiredRef.current = true;
            setIsComplete(true);
            setIsExiting(true);
            
            // Allow exit animation to complete before calling onComplete
            const timer = setTimeout(() => {
                onComplete();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [progress, onComplete]);

    return (
        <div
            className={`domain-preloader ${isExiting ? 'domain-preloader--exiting' : ''} ${isComplete ? 'domain-preloader--complete' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Initializing AI Trading Interface"
        >
            {/* World-Class Background Neural Network & Glows */}
            <div className='preloader-bg-ambient'>
                <div className='glow-blob glow-blob--1' />
                <div className='glow-blob glow-blob--2' />
                <div className='glow-blob glow-blob--3' />
            </div>
            
            <div className='preloader-grid' />

            {/* Neural Connections */}
            <svg className='preloader-neural-net' viewBox='0 0 100 100' preserveAspectRatio='none'>
                {neuralNodes.map((node, index) => {
                    const nextNode = neuralNodes[(index + 1) % neuralNodes.length];
                    return (
                        <line
                            key={`line-${node.id}`}
                            x1={`${node.x}%`}
                            y1={`${node.y}%`}
                            x2={`${nextNode.x}%`}
                            y2={`${nextNode.y}%`}
                            className='neural-line'
                        />
                    );
                })}
                {neuralNodes.map(node => (
                    <circle
                        key={`node-${node.id}`}
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r={node.size / 15}
                        className='neural-node'
                        style={{ animationDelay: `${node.delay}s` }}
                    />
                ))}
            </svg>

            {/* Side Floating Holographic Panels */}
            {floatingPanels.map(panel => (
                <div key={panel.id} className={`floating-hologram ${panel.class}`}>
                    <div className='hologram-glow' />
                    <div className='hologram-content'>
                        <span className='hologram-label'>{panel.label}</span>
                        <span className={`hologram-val hologram-val--${panel.type}`}>{panel.value}</span>
                    </div>
                </div>
            ))}

            {/* Main Center Glass Card */}
            <div className='preloader-center-card'>
                <div className='card-glow-border' />

                {/* Logo Section */}
                <div className='preloader-logo-area'>
                    <div className='logo-shine-wrapper'>
                        <h1 className='preloader-logo-title'>
                            PROFIT HUB <span className='logo-accent'>AI</span>
                        </h1>
                    </div>
                </div>

                {/* AI Core Holographic Animation */}
                <div className='ai-core-processor'>
                    <div className='core-orbit core-orbit--outer' />
                    <div className='core-orbit core-orbit--mid' />
                    <div className='core-orbit core-orbit--inner' />
                    <div className='core-glow-center'>
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='core-ai-symbol'>
                            <path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' />
                        </svg>
                    </div>
                    <div className='core-pulse-wave' />
                </div>

                {/* Status text fades */}
                <div className='preloader-status-text'>
                    {statusIndex === 0 && <span className='status-msg'>Initializing AI Engine...</span>}
                    {statusIndex === 1 && <span className='status-msg'>Connecting to Deriv Markets...</span>}
                    {statusIndex === 2 && <span className='status-msg'>Loading Trading Models...</span>}
                    {statusIndex === 3 && <span className='status-msg'>Analyzing Market Data...</span>}
                    {statusIndex === 4 && <span className='status-msg'>Preparing Dashboard...</span>}
                </div>

                {/* Modern Shimmer Progress Bar */}
                <div className='preloader-progress-container'>
                    <div className='preloader-progress-track'>
                        <div
                            className='preloader-progress-fill'
                            style={{ width: `${progress}%` }}
                        >
                            <div className='progress-shimmer' />
                        </div>
                    </div>
                    <div className='preloader-percentage-counter'>
                        {Math.round(progress)}%
                    </div>
                </div>

                {/* Sequentially Lit Status Pills */}
                <div className='live-status-indicators'>
                    <span className={`status-pill ${progress >= 15 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> AI Engine Ready
                    </span>
                    <span className={`status-pill ${progress >= 35 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> WS Connected
                    </span>
                    <span className={`status-pill ${progress >= 60 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> Market Scanner Active
                    </span>
                    <span className={`status-pill ${progress >= 85 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> AI Models Loaded
                    </span>
                </div>
            </div>

            {/* Bottom Brand Technology Credits */}
            <div className='preloader-powered-by'>
                <span className='powered-text'>Powered by</span>
                <span className='powered-brand-logo'>DERIV</span>
                <span className='powered-tech-tag'>AI TECHNOLOGY</span>
            </div>
        </div>
    );
};
export default DomainPreloader;
