import { TrendingUp } from '@/components/startup-loader/loader-icons';
import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='chunk-loader-container'>
            <div className='modern-loader'>
                <div className='loader-ring loader-ring-1'></div>
                <div className='loader-ring loader-ring-2'></div>
                <div className='loader-icon-container'>
                    <TrendingUp size={28} strokeWidth={2.5} />
                </div>
            </div>
            {message && <div className='chunk-loader-message'>{message}</div>}
        </div>
    );
}
