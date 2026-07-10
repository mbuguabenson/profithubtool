import React, { useEffect, useState, useRef, useMemo } from 'react';
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
    minimumDuration = 6000,
    maximumDuration = 15000,
    onComplete,
}) => {
    const [isExiting, setIsExiting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);
    const completionFiredRef = useRef(false);

    const { progress } = useLoaderProgress({
        appReady: appReady,
        minimumDuration: minimumDuration,
        maximumDuration: maximumDuration,
    });

    // Update status text based on progress thresholds
    useEffect(() => {
        if (progress < 25) setStatusIndex(0);
        else if (progress < 50) setStatusIndex(1);
        else if (progress < 75) setStatusIndex(2);
        else setStatusIndex(3);
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
            aria-label="Initializing ProfitHub AI"
        >
            {/* World-Class Premium Background */}
            <div className='preloader-bg-overlay' />
            
            {/* Main Center Floating Glass Card */}
            <div className='preloader-classic-card'>
                {/* Blue Badge Icon */}
                <div className='brand-badge'>
                    <span className='brand-badge-text'>BT</span>
                </div>

                {/* Brand Logo Title */}
                <h1 className='preloader-brand-title'>BINARYTOOL</h1>
                <p className='preloader-brand-subtitle'>BinaryTool Trading Workspace</p>

                {/* Triple Pulsing Dots */}
                <div className='loading-pulse-dots'>
                    <span className='pulse-dot' />
                    <span className='pulse-dot' />
                    <span className='pulse-dot' />
                </div>

                {/* Changing Status Message */}
                <div className='preloader-boot-status'>
                    {statusIndex === 0 && <span className='boot-msg'>Initializing D-Bot...</span>}
                    {statusIndex === 1 && <span className='boot-msg'>Connecting to Server...</span>}
                    {statusIndex === 2 && <span className='boot-msg'>Loading Trade Engine...</span>}
                    {statusIndex === 3 && <span className='boot-msg'>Restoring workspace session...</span>}
                </div>

                {/* Progress Bar & Boot Sequence */}
                <div className='boot-progress-area'>
                    <div className='boot-progress-info'>
                        <span className='boot-sequence-label'>Boot sequence</span>
                        <span className='boot-percentage-value'>{Math.round(progress)}%</span>
                    </div>
                    <div className='boot-progress-track'>
                        <div
                            className='boot-progress-fill'
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
export default DomainPreloader;
