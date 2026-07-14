import { observer } from 'mobx-react-lite';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';

type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = observer(({ width, height = 32, className = '' }: TBrandLogoProps) => {
    const { is_dark_mode_on } = useThemeSwitcher();
    return (
        <img
            src={is_dark_mode_on ? '/logo_dark.png' : '/logo_light.png'}
            alt='Logo'
            style={{ width: width ? `${width}px` : 'auto', height: `${height}px`, display: 'block' }}
            className={className}
        />
    );
});
