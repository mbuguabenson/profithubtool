import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import './UltimateWelcomePage.scss';

// Typing effect words
const TYPING_WORDS = [
    'AI Powered',
    'Digit Trading',
    'Automation',
    'Risk Management',
    'Market Analysis'
];

export const UltimateWelcomePage = observer(({ handleTabChange }: { handleTabChange: (active_number: number) => void }) => {
    const { dashboard, load_modal, quick_strategy, client } = useStore();
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { setActiveTab } = dashboard;
    const { setFormVisibility } = quick_strategy;
    const { isDesktop } = useDevice();

    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [typedText, setTypedText] = useState('');
    const [wordIndex, setWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeMarketsCount, setActiveMarketsCount] = useState(0);
    const [botTemplatesCount, setBotTemplatesCount] = useState(0);
    const [showAssistantBubble, setShowAssistantBubble] = useState(false);
    const [activityIndex, setActivityIndex] = useState(0);

    const activityLogs = [
        localize('Connected to Deriv'),
        localize('Market data synchronized'),
        localize('Ready to build bot'),
        localize('AI Engine Online')
    ];

    // Determine Greeting & Username
    useEffect(() => {
        const hours = new Date().getHours();
        if (hours < 12) setGreeting(localize('Morning'));
        else if (hours < 18) setGreeting(localize('Afternoon'));
        else setGreeting(localize('Evening'));

        try {
            const infoCookie = Cookies.get('client_information');
            if (infoCookie) {
                const info = JSON.parse(infoCookie);
                if (info.first_name) {
                    setUserName(info.first_name);
                    return;
                }
            }
            const email = localStorage.getItem('client_email') || '';
            if (email) {
                setUserName(email.split('@')[0]);
                return;
            }
        } catch (e) {
            console.error('Failed to parse name info:', e);
        }
        setUserName('Trader');
    }, []);

    // Typing Effect Logic
    useEffect(() => {
        let typingTimeout: NodeJS.Timeout;
        const currentWord = TYPING_WORDS[wordIndex];
        const typingSpeed = isDeleting ? 40 : 80;

        if (!isDeleting && typedText === currentWord) {
            typingTimeout = setTimeout(() => setIsDeleting(true), 1500);
        } else if (isDeleting && typedText === '') {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % TYPING_WORDS.length);
        } else {
            typingTimeout = setTimeout(() => {
                setTypedText(
                    isDeleting
                        ? currentWord.substring(0, typedText.length - 1)
                        : currentWord.substring(0, typedText.length + 1)
                );
            }, typingSpeed);
        }

        return () => clearTimeout(typingTimeout);
    }, [typedText, isDeleting, wordIndex]);

    // Statistics Counter Animation
    useEffect(() => {
        let startTime: number | null = null;
        const duration = 2000; // 2 seconds

        const animateCounters = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Ease out quad formula
            const easeProgress = progress * (2 - progress);

            setActiveMarketsCount(Math.floor(easeProgress * 120));
            setBotTemplatesCount(Math.floor(easeProgress * 350));

            if (progress < 1) {
                requestAnimationFrame(animateCounters);
            }
        };

        requestAnimationFrame(animateCounters);
    }, []);

    // Activity Log Fading sequence
    useEffect(() => {
        if (activityIndex < activityLogs.length - 1) {
            const timer = setTimeout(() => {
                setActivityIndex(prev => prev + 1);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [activityIndex]);

    // Card Callbacks
    const openFileLoader = () => {
        toggleLoadModal();
        setActiveTabIndex(isDesktop ? 1 : 0);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openGoogleDriveDialog = () => {
        toggleLoadModal();
        setActiveTabIndex(isDesktop ? 2 : 1);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openBotBuilder = () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openQuickStrategy = () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
        setFormVisibility(true);
    };

    return (
        <div className='ultimate-landing'>
            {/* Ambient Background Graphics */}
            <div className='ultimate-landing__bg-glow ultimate-landing__bg-glow--primary' />
            <div className='ultimate-landing__bg-glow ultimate-landing__bg-glow--secondary' />

            <div className='ultimate-landing__grid-overlay'>
                {/* SVG Animated Grid */}
                <svg width='100%' height='100%' xmlns='http://www.w3.org/2000/svg' className='ultimate-landing__grid-svg'>
                    <defs>
                        <pattern id='grid-pattern' width='60' height='60' patternUnits='userSpaceOnUse'>
                            <path d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(255, 255, 255, 0.02)' strokeWidth='1' />
                        </pattern>
                    </defs>
                    <rect width='100%' height='100%' fill='url(#grid-pattern)' />
                </svg>
            </div>

            {/* Floating Candlestick animations for depth */}
            <div className='ultimate-landing__candles'>
                <div className='candle candle--green candle-1' />
                <div className='candle candle--red candle-2' />
                <div className='candle candle--green candle-3' />
                <div className='candle candle--red candle-4' />
            </div>

            {/* Profile Section (Top Left) */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className='ultimate-landing__profile'
            >
                <div className='profile-card'>
                    <div className='profile-card__avatar'>
                        <span>{userName.substring(0, 2).toUpperCase()}</span>
                        <div className='profile-card__indicator' />
                    </div>
                    <div className='profile-card__info'>
                        <div className='profile-card__name'>{userName}</div>
                        <div className='profile-card__id'>{client.loginid || localize('Not connected')}</div>
                        <div className='profile-card__status'>{localize('Connected to Deriv')}</div>
                    </div>
                </div>
            </motion.div>

            {/* Hero Main Header Section */}
            <div className='ultimate-landing__hero'>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className='ultimate-landing__welcome'
                >
                    <h2 className='welcome-greeting'>
                        {localize('Good')} {greeting} {userName} 👋
                    </h2>
                    <h3 className='welcome-subtitle'>{localize('Welcome back to Ultimate Traders.')}</h3>
                    <p className='welcome-tagline'>{localize('Your AI trading workspace is ready. Let\'s build smarter strategies today.')}</p>
                </motion.div>

                {/* Animated Typing Title */}
                <motion.h1 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className='ultimate-landing__title'
                >
                    {localize('Build Intelligent Trading Bots')}
                    <span className='typing-text'> {typedText}</span>
                    <span className='typing-cursor'>|</span>
                </motion.h1>

                <p className='ultimate-landing__subtitle'>
                    {localize('Import an existing bot, create one from scratch, or launch an intelligent strategy powered by AI.')}
                </p>
            </div>

            {/* Centered Bot Action Cards Row */}
            <div className='ultimate-landing__cards-container'>
                <div className='ultimate-landing__cards-grid'>
                    {/* Card 1: Local Computer Import */}
                    <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        className='ultimate-landing__card card--blue'
                        onClick={openFileLoader}
                    >
                        <div className='card__icon'>📂</div>
                        <h3 className='card__title'>{localize('My Computer')}</h3>
                        <p className='card__description'>
                            {localize('Import saved trading bots from your local computer.')}
                        </p>
                        <div className='card__arrow'>→</div>
                        <div className='card__glow' />
                    </motion.div>

                    {/* Card 2: Google Drive Import */}
                    <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        className='ultimate-landing__card card--green'
                        onClick={openGoogleDriveDialog}
                    >
                        <div className='card__icon'>☁️</div>
                        <h3 className='card__title'>{localize('Google Drive')}</h3>
                        <p className='card__description'>
                            {localize('Open bots stored securely inside Google Drive.')}
                        </p>
                        <div className='card__arrow'>→</div>
                        <div className='card__glow' />
                    </motion.div>

                    {/* Card 3: Bot Builder */}
                    <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        className='ultimate-landing__card card--emerald'
                        onClick={openBotBuilder}
                    >
                        {/* Custom circuit board background pattern for AI themed card */}
                        <div className='card__circuit-glow' />
                        <div className='card__icon'>🤖</div>
                        <h3 className='card__title'>{localize('Bot Builder')}</h3>
                        <p className='card__description'>
                            {localize('Create powerful automated trading bots visually.')}
                        </p>
                        <div className='card__arrow'>→</div>
                        <div className='card__glow' />
                    </motion.div>

                    {/* Card 4: Quick Strategy */}
                    <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        className='ultimate-landing__card card--purple'
                        onClick={openQuickStrategy}
                    >
                        <div className='card__icon'>⚡</div>
                        <h3 className='card__title'>{localize('Quick Strategy')}</h3>
                        <p className='card__description'>
                            {localize('Launch ready-made trading strategies instantly.')}
                        </p>
                        <div className='card__arrow'>→</div>
                        <div className='card__glow' />
                    </motion.div>
                </div>
            </div>

            {/* Premium CTA Buttons */}
            <div className='ultimate-landing__cta'>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={openBotBuilder}
                    className='cta-btn cta-btn--primary'
                >
                    {localize('Start Trading')} <span className='arrow'>→</span>
                </motion.button>
                <button onClick={openQuickStrategy} className='cta-btn cta-btn--secondary'>
                    {localize('Explore Features')}
                </button>
            </div>

            {/* Trading Statistics Strip */}
            <div className='ultimate-landing__stats-container'>
                <div className='ultimate-landing__stats-strip'>
                    <div className='stat-card'>
                        <div className='stat-card__number'>{activeMarketsCount}+</div>
                        <div className='stat-card__label'>{localize('Active Markets')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number'>{botTemplatesCount}+</div>
                        <div className='stat-card__label'>{localize('Bot Templates')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number'>{localize('Live')}</div>
                        <div className='stat-card__label'>{localize('AI Signals')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number connected-status'>
                            {localize('Connected')} <span className='dot' />
                        </div>
                        <div className='stat-card__label'>{localize('System Status')}</div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Log (Bottom Left) */}
            <div className='ultimate-landing__activity'>
                <div className='activity-card'>
                    <h4 className='activity-card__title'>{localize('Latest Activity')}</h4>
                    <div className='activity-card__list'>
                        {activityLogs.slice(0, activityIndex + 1).map((log, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className='activity-card__item'
                            >
                                <span className='check'>✓</span> {log}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating AI Orb Assistant Widget (Bottom Right) */}
            <div 
                className='ultimate-landing__assistant'
                onMouseEnter={() => setShowAssistantBubble(true)}
                onMouseLeave={() => setShowAssistantBubble(false)}
            >
                <AnimatePresence>
                    {showAssistantBubble && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className='assistant-bubble'
                        >
                            <p className='bubble-title'>{localize('Need help?')}</p>
                            <p className='bubble-desc'>{localize('Ask Ultimate AI.')}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className='assistant-orb'>
                    <div className='assistant-orb__inner' />
                    <div className='assistant-orb__pulse' />
                </div>
            </div>

            {/* Premium Minimal Glass Footer */}
            <footer className='ultimate-landing__footer'>
                <div className='footer-content'>
                    <div className='footer-left'>
                        {localize('Powered by Deriv API')}
                    </div>
                    <div className='footer-center'>
                        <span className='deriv-icon-glow' />
                        {localize('Ultimate Traders AI')} • {localize('Version 2.0')}
                    </div>
                    <div className='footer-right'>
                        {localize('Secure • Fast • Intelligent')}
                    </div>
                </div>
            </footer>
        </div>
    );
});

export default UltimateWelcomePage;
