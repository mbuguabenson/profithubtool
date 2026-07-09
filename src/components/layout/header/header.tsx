import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useApiBase } from '@/hooks/useApiBase';
import { useLogout } from '@/hooks/useLogout';
import { useStore } from '@/hooks/useStore';
import { navigateToTransfer } from '@/utils/transfer-utils';
import { Localize } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import AccountSwitcher from './account-switcher';
import MenuItems from './menu-items';
import MobileMenu from './mobile-menu';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { LegacyThemeDarkIcon, LegacyThemeLightIcon } from '@deriv/quill-icons/Legacy';
import './header.scss';

const CurrencyConverter = ({ activeAccount }: { activeAccount: any }) => {
    const [rate, setRate] = useState<number>(129.5);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                if (data?.rates?.KES) {
                    setRate(data.rates.KES);
                }
            })
            .catch(err => console.warn('Failed to fetch real-time KES exchange rate:', err));
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const balanceStr = activeAccount?.balance || '0';
    const balanceNum = parseFloat(balanceStr.replace(/,/g, '')) || 0;
    const currency = activeAccount?.currency || 'USD';
    const convertedBalance = balanceNum * rate;

    const formattedUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceNum);
    const formattedKes = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(convertedBalance);

    return (
        <div style={{ position: 'relative' }} ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'var(--general-section-1)',
                    border: '1px solid var(--border-normal)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    color: 'var(--text-general)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    height: '32px',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'var(--general-hover)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'var(--general-section-1)';
                }}
                type='button'
            >
                <span style={{ fontSize: '14px' }}>💵</span>
                <span>KES {formattedKes}</span>
            </button>

            {isOpen && (
                <div
                    className='currency-converter-popover'
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        width: '260px',
                        background: 'var(--general-main-1)',
                        border: '1px solid var(--border-normal)',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}
                >
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-general)' }}>
                        Balance Converter
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-less-prominent)' }}>Active Balance</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-general)' }}>
                            {formattedUsd} {currency}
                        </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-normal)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-less-prominent)' }}>Equivalent in KES</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4caf50' }}>
                            {formattedKes} KES
                        </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-normal)' }} />
                    <div style={{ fontSize: '10px', color: 'var(--text-less-prominent)', textAlign: 'right' }}>
                        Rate: 1 USD = {rate.toFixed(2)} KES
                    </div>
                </div>
            )}
        </div>
    );
};

const ChangeSpeedHeader = () => {
    const [isSpeedMode, setIsSpeedMode] = useState(() => {
        return localStorage.getItem('is_speed_mode_on') === 'true';
    });

    const toggleSpeedMode = () => {
        const nextState = !isSpeedMode;
        localStorage.setItem('is_speed_mode_on', String(nextState));
        setIsSpeedMode(nextState);
        window.dispatchEvent(new Event('speed_mode_changed'));
    };

    useEffect(() => {
        const handleSync = () => {
            setIsSpeedMode(localStorage.getItem('is_speed_mode_on') === 'true');
        };
        window.addEventListener('speed_mode_changed', handleSync);
        return () => window.removeEventListener('speed_mode_changed', handleSync);
    }, []);

    return (
        <button
            onClick={toggleSpeedMode}
            style={{
                background: isSpeedMode ? 'rgba(255, 68, 79, 0.15)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                color: isSpeedMode ? '#ff444f' : 'var(--text-general)',
                transition: 'all 0.2s',
                border: isSpeedMode ? '1px solid rgba(255, 68, 79, 0.3)' : '1px solid transparent',
                height: '32px',
                width: '32px',
            }}
            title={isSpeedMode ? 'Speed Mode: MAX (Trading every tick)' : 'Speed Mode: NORMAL'}
            type='button'
        >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>⚡</span>
        </button>
    );
};

const ChangeThemeHeader = observer(() => {
    const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();

    return (
        <button
            className='header-theme-toggle'
            onClick={toggleTheme}
            style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                color: 'var(--text-general)',
                transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--general-hover)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label='Toggle theme'
        >
            {!is_dark_mode_on ? (
                <LegacyThemeLightIcon iconSize='xs' fill='var(--text-general)' />
            ) : (
                <LegacyThemeDarkIcon iconSize='xs' fill='var(--text-general)' />
            )}
        </button>
    );
});

const AppHeader = observer(() => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid, setIsAuthorizing, authData } = useApiBase();
    const { client } = useStore() ?? {};
    const [authTimeout, setAuthTimeout] = useState(false);
    const is_account_regenerating = client?.is_account_regenerating || false;

    // Detect OAuth callback on mount (before App.tsx cleans up the URL).
    // When ?code=...&state=... is present the full auth flow can take 7-15 s
    // (token exchange → accounts fetch → OTP → WebSocket auth), so we must
    // suppress the short fallback timeout and keep the spinner throughout.
    const [isOAuthPending, setIsOAuthPending] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(params.get('code') && params.get('state'));
    });

    const { data: activeAccount } = useActiveAccount({
        allBalanceData: client?.all_accounts_balance,
        directBalance: client?.balance,
    });

    const handleLogout = useLogout();

    // Clear OAuth-pending flag once the account is set (auth succeeded)
    // or after a generous timeout in case something goes wrong.
    useEffect(() => {
        if (!isOAuthPending) return;

        if (activeLoginid) {
            setIsOAuthPending(false);
            return;
        }

        // Safety net: give up after 30 s and let the normal flow decide
        const timer = setTimeout(() => setIsOAuthPending(false), 30_000);
        return () => clearTimeout(timer);
    }, [isOAuthPending, activeLoginid]);

    // Handle direct URL access with legacy token param
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const account_id = urlParams.get('account_id');
        if (account_id) {
            setIsAuthorizing(true);
        }
    }, [setIsAuthorizing]);

    // Fallback timeout: show login button if auth never resolves.
    // Suppressed during the OAuth callback flow (isOAuthPending = true).
    useEffect(() => {
        if (isOAuthPending) return;

        const timer = setTimeout(() => {
            if (isAuthorizing && !activeLoginid) {
                setAuthTimeout(true);
                setIsAuthorizing(false);
            }
        }, 5000);

        if (activeLoginid || !isAuthorizing) {
            if (authTimeout) setAuthTimeout(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [isAuthorizing, activeLoginid, setIsAuthorizing, authTimeout, isOAuthPending]);

    const handleSignup = useCallback(async () => {
        try {
            setIsAuthorizing(true);
            const oauthUrl = await generateOAuthURL('registration');
            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL for signup');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Signup redirection failed:', error);
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleLogin = useCallback(async () => {
        try {
            // Set authorizing state immediately when login is clicked
            setIsAuthorizing(true);

            // Generate OAuth URL with CSRF token and PKCE parameters
            const oauthUrl = await generateOAuthURL();

            if (oauthUrl) {
                // Redirect to OAuth URL
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Login redirection failed:', error);
            // Reset authorizing state if redirection fails
            setIsAuthorizing(false);
        }
    }, [setIsAuthorizing]);

    const handleTransfer = useCallback(() => {
        const transferCurrency = authData?.currency;
        if (!transferCurrency) {
            console.error('No currency available for transfer');
            return;
        }
        navigateToTransfer(transferCurrency);
    }, [authData?.currency]);

    const renderAccountSection = useCallback(
        (position: 'left' | 'right' = 'right') => {
            // Show account switcher and logout when user is fully authenticated
            if (activeLoginid && !is_account_regenerating) {
                if (position === 'left' && !isDesktop) {
                    // For mobile left section - only account switcher
                    return (
                        <div className='auth-actions'>
                            <div className='account-info'>
                                <AccountSwitcher activeAccount={activeAccount} />
                            </div>
                        </div>
                    );
                } else if (position === 'right') {
                    // For right section - transfer button (and account switcher on desktop)
                    return (
                        <div className='auth-actions'>
                            {isDesktop && (
                                <div className='account-info'>
                                    <AccountSwitcher activeAccount={activeAccount} />
                                </div>
                            )}
                            <Button
                                primary
                                disabled={client?.is_logging_out || !authData?.currency}
                                onClick={handleTransfer}
                            >
                                <Localize i18n_default_text='Transfer' />
                            </Button>
                        </div>
                    );
                }
            }
            // Show login button only when fully settled (not during OAuth flow)
            else if (
                position === 'right' &&
                !isOAuthPending &&
                ((!is_account_regenerating && !isAuthorizing && !activeLoginid) || authTimeout)
            ) {
                return (
                    <div className='auth-actions'>
                        <Button tertiary onClick={handleLogin}>
                            <Localize i18n_default_text='Log in' />
                        </Button>
                        <Button primary_light onClick={handleSignup}>
                            <Localize i18n_default_text='Sign up' />
                        </Button>
                    </div>
                );
            }
            // Default: Show spinner during loading states or when authorizing
            else if (position === 'right') {
                return (
                    <div className='auth-actions auth-actions--loading'>
                        <svg
                            className='auth-actions__spinner'
                            viewBox='0 0 24 24'
                            fill='none'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <circle
                                cx='12'
                                cy='12'
                                r='10'
                                stroke='currentColor'
                                strokeWidth='2.5'
                                strokeLinecap='round'
                                strokeDasharray='31.416'
                                strokeDashoffset='10'
                            />
                        </svg>
                    </div>
                );
            }

            return null;
        },
        [
            isAuthorizing,
            isDesktop,
            activeLoginid,
            client,
            activeAccount,
            authTimeout,
            is_account_regenerating,
            isOAuthPending,
            authData,
            handleLogin,
            handleSignup,
            handleTransfer,
        ]
    );

    if (client?.should_hide_header) return null;

    return (
        <>
            <Header
                className={clsx('app-header', {
                    'app-header--desktop': isDesktop,
                    'app-header--mobile': !isDesktop,
                })}
            >
                <Wrapper variant='left'>
                    <MobileMenu onLogout={handleLogout} />
                    <AppLogo />
                    {isDesktop ? <MenuItems /> : renderAccountSection('left')}
                </Wrapper>
                <Wrapper variant='right'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CurrencyConverter activeAccount={activeAccount} />
                        <ChangeSpeedHeader />
                        <ChangeThemeHeader />
                        {renderAccountSection('right')}
                    </div>
                </Wrapper>
            </Header>
        </>
    );
});

export default AppHeader;
