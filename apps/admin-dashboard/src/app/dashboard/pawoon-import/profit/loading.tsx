import { Loader2 } from 'lucide-react';

export default function LoadingProfit() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-12 h-12 text-suka-primary animate-spin" />
            <div className="text-center">
                <h2 className="text-lg font-bold text-gray-800">Menghitung Profit...</h2>
                <p className="text-sm text-gray-500 max-w-sm mt-1">Sistem sedang menarik ribuan data pesanan dan mencocokkan harga modal (HPP). Mohon tunggu beberapa detik.</p>
            </div>
        </div>
    );
}
