import React, { useEffect, useState, useRef } from 'react';
import { useDomainLoaderConfig } from '../useDomainLoaderConfig';
import { useLoaderProgress } from '../useLoaderProgress';
import { CircularLoader } from './CircularLoader';
import { LoadingProgress } from './LoadingProgress';
import { LoadingStatus } from './LoadingStatus';
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
    minimumDuration = 3000,
    maximumDuration = 15000,
    onComplete,
}) => {
    const config = useDomainLoaderConfig();
    const [isExiting, setIsExiting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [showReducedLoader, setShowReducedLoader] = useState(false);
    const completionFiredRef = useRef(false);

    useEffect(() => {
        if (disableSessionReduction) return;
        const hasLoaderShown = sessionStorage.getItem('siteLoaderShown');
        if (hasLoaderShown) {
            setShowReducedLoader(true);
        }
    }, [disableSessionReduction]);

    const effectiveDuration = showReducedLoader ? 1500 : maximumDuration;
    const effectiveMinimum = showReducedLoader ? 500 : minimumDuration;

    const { progress } = useLoaderProgress({
        appReady: appReady || showReducedLoader,
        minimumDuration: effectiveMinimum,
        maximumDuration: effectiveDuration,
    });

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

    useEffect(() => {
        if (progress >= 100 && !completionFiredRef.current) {
            completionFiredRef.current = true;
            setIsComplete(true);
            setIsExiting(true);
            sessionStorage.setItem('siteLoaderShown', 'true');
            onComplete();
        }
    }, [progress, onComplete]);

    const cssVariables = {
        '--loader-primary': config.primaryColor,
        '--loader-secondary': config.secondaryColor,
        '--loader-accent': config.accentColor,
        '--loader-background': config.backgroundColor,
    } as React.CSSProperties;

    return (
        <div
            className={`domain-preloader ${isExiting ? 'domain-preloader--exiting' : ''} ${isComplete ? 'domain-preloader--complete' : ''}`}
            style={cssVariables}
        >
            {/* Cyberpunk Grid Background */}
            <div className='domain-preloader__background' />
            <div className='domain-preloader__grid' />
            
            {/* Glowing Ambient Orbs */}
            <div className='domain-preloader__ambient-orb domain-preloader__ambient-orb--1' />
            <div className='domain-preloader__ambient-orb domain-preloader__ambient-orb--2' />

            {/* Futuristic Glass Container */}
            <div className='domain-preloader__glass-card'>
                {/* Header Section */}
                <div className='domain-preloader__header'>
                    <div className='domain-preloader__badge'>
                        <span className='domain-preloader__badge-dot' />
                        SECURE TRADING LINK ESTABLISHED
                    </div>
                    <h1 className='domain-preloader__title' style={{ color: config.accentColor }}>
                        {config.siteName || 'ProfitHub'}
                    </h1>
                    <p className='domain-preloader__subtitle' style={{ color: config.primaryColor }}>
                        {config.subtitle || 'Premium Automated Options Trading'}
                    </p>
                </div>

                {/* Circular Pulse Ring & Percentage */}
                <div className='domain-preloader__ring-wrapper'>
                    <CircularLoader
                        progress={progress}
                        primaryColor={config.primaryColor}
                        secondaryColor={config.secondaryColor}
                        accentColor={config.accentColor}
                        siteName=''
                        isComplete={isComplete}
                    />
                </div>

                {/* Progress bar */}
                <LoadingProgress
                    progress={progress}
                    primaryColor={config.primaryColor}
                    secondaryColor={config.secondaryColor}
                />

                {/* Loading status */}
                <LoadingStatus
                    progress={progress}
                    messages={config.messages}
                    accentColor={config.accentColor}
                    primaryColor={config.primaryColor}
                    isComplete={isComplete}
                />

                {/* Footer Disclaimer */}
                <div className='domain-preloader__footer' style={{ color: `${config.accentColor}40` }}>
                    {config.footerText || 'ProfitHub Secure Infrastructure v2.4.0'}
                </div>
            </div>
        </div>
    );
};
export default DomainPreloader;
