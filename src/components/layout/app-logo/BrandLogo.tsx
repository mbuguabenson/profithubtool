type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({
    width = 120,
    height = 32,
    className = ''
}: TBrandLogoProps) => {
    return (
        <img
            src="/logo.png"
            alt="Ultimate Protool Logo"
            style={{ width: 'auto', height: `${height}px`, display: 'block' }}
            className={className}
        />
    );
};
