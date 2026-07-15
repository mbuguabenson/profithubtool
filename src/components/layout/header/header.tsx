import { useCallback, useEffect, useState } from 'react';
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
import './header.scss';

// ─────────────────────────────────────────────────────────────────────────────
// Currency Dropdown  (USD / KES)
// ─────────────────────────────────────────────────────────────────────────────
const CurrencyDropdown = () => {
    const [currency, setCurrency] = useState<'USD' | 'KES'>(() => {
        return (localStorage.getItem('converter_display_currency') as 'USD' | 'KES') || 'USD';
    });

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value as 'USD' | 'KES';
        localStorage.setItem('converter_display_currency', next);
        setCurrency(next);
        window.dispatchEvent(new Event('currency_changed'));
    };

    // Sync across tabs / other components
    useEffect(() => {
        const handleSync = () => {
            setCurrency((localStorage.getItem('converter_display_currency') as 'USD' | 'KES') || 'USD');
        };
        window.addEventListener('currency_changed', handleSync);
        return () => window.removeEventListener('currency_changed', handleSync);
    }, []);

    // Fetch live KES rate once on mount
    useEffect(() => {
        const fetchRate = () => {
            fetch('https://open.er-api.com/v6/latest/USD')
                .then(res => res.json())
                .then(data => {
                    if (data?.rates?.KES) {
                        localStorage.setItem('converter_kes_rate', String(data.rates.KES));
                        window.dispatchEvent(new Event('currency_changed'));
                    }
                })
                .catch(err => console.warn('Failed to fetch KES rate:', err));
        };
        fetchRate();
    }, []);

    return (
        <div className='currency-dropdown'>
            <select
                id='currency-select'
                className='currency-dropdown__select'
                value={currency}
                onChange={handleChange}
                title='Select display currency (USD / KES)'
            >
                <option value='USD'>USD</option>
                <option value='KES'>KES</option>
            </select>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Speed Selector  (Normal / Fast / Turbo)
// ─────────────────────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [
    { value: '1', label: '1x' },
    { value: '2', label: '2x' },
    { value: '3', label: '3x' },
] as const;

export const SpeedSelector = () => {
    const [speed, setSpeed] = useState<string>(() => {
        return localStorage.getItem('bot_execution_speed') || '1';
    });

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        localStorage.setItem('bot_execution_speed', next);
        setSpeed(next);
        window.dispatchEvent(new CustomEvent('bot_speed_changed', { detail: { speed: next } }));
    };

    // Sync when speed changes from elsewhere
    useEffect(() => {
        const handleSync = () => {
            setSpeed(localStorage.getItem('bot_execution_speed') || '1');
        };
        window.addEventListener('bot_speed_changed', handleSync);
        return () => window.removeEventListener('bot_speed_changed', handleSync);
    }, []);

    const isActive = speed !== '1';

    return (
        <div className={clsx('speed-selector', { 'speed-selector--active': isActive })} title='Bot execution speed'>
            <span className='speed-selector__icon'>
                {/* Lightning bolt SVG */}
                <svg viewBox='0 0 24 24' width='14' height='14' fill='currentColor'>
                    <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
                </svg>
            </span>
            <select
                id='speed-select'
                className='speed-selector__select'
                value={speed}
                onChange={handleChange}
            >
                {SPEED_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main AppHeader
// ─────────────────────────────────────────────────────────────────────────────
const AppHeader = observer(() => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid, setIsAuthorizing, authData } = useApiBase();
    const { client } = useStore() ?? {};
    const [authTimeout, setAuthTimeout] = useState(false);
    const is_account_regenerating = client?.is_account_regenerating || false;

    // Detect OAuth callback on mount (before App.tsx cleans up the URL).
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
    useEffect(() => {
        if (!isOAuthPending) return;
        if (activeLoginid) {
            setIsOAuthPending(false);
            return;
        }
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

    // Fallback timeout
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
            setIsAuthorizing(true);
            const oauthUrl = await generateOAuthURL();
            if (oauthUrl) {
                window.location.replace(oauthUrl);
            } else {
                console.error('Failed to generate OAuth URL');
                setIsAuthorizing(false);
            }
        } catch (error) {
            console.error('Login redirection failed:', error);
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
                    return (
                        <div className='auth-actions'>
                            <div className='account-info'>
                                <AccountSwitcher activeAccount={activeAccount} />
                            </div>
                        </div>
                    );
                } else if (position === 'right') {
                    return (
                        <div className='auth-actions'>
                            {isDesktop && (
                                <div className='account-info'>
                                    <AccountSwitcher activeAccount={activeAccount} />
                                </div>
                            )}
                            {isDesktop && (
                                <Button
                                    primary
                                    disabled={client?.is_logging_out || !authData?.currency}
                                    onClick={handleTransfer}
                                >
                                    <Localize i18n_default_text='Transfer' />
                                </Button>
                            )}
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
            // Default: spinner during loading
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
                        {/* Currency dropdown (replaces toggle) — only when logged in */}
                        {activeLoginid && <CurrencyDropdown />}
                        {/* Speed selector — always visible */}
                        <SpeedSelector />
                        {renderAccountSection('right')}
                    </div>
                </Wrapper>
            </Header>
        </>
    );
});

export default AppHeader;
