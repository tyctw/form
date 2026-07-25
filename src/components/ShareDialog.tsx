import { Copy, Share2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  url?: string;
};

export function ShareDialog({ open, onClose, url }: ShareDialogProps) {
  if (!open) return null;
  const shareUrl = url ?? window.location.href;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <div className="relative w-full max-w-md border-4 border-slate-900 bg-white p-6 sm:p-8 text-center shadow-[8px_8px_0_#0F172A]">
        <button onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-400 transition-colors hover:text-slate-900" aria-label="關閉分享視窗">
          <X className="w-6 h-6" />
        </button>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-100 text-blue-600">
          <Share2 className="w-6 h-6" />
        </div>
        <h2 id="share-dialog-title" className="text-xl font-black tracking-tight">分享本頁</h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">掃描 QR Code 或複製連結，分享目前頁面。</p>
        <div className="mx-auto my-6 inline-block border-4 border-slate-900 bg-white p-4 shadow-[4px_4px_0_#0F172A]">
          <QRCodeSVG value={shareUrl} size={200} bgColor="#ffffff" fgColor="#0f172a" level="H" includeMargin={false} />
        </div>
        <button onClick={copyLink} className="flex w-full items-center justify-center gap-2 border-2 border-slate-900 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 shadow-[4px_4px_0_#0F172A] transition-all hover:bg-slate-100 active:translate-x-1 active:translate-y-1 active:shadow-none">
          <Copy className="w-5 h-5" /> 複製頁面連結
        </button>
      </div>
    </div>
  );
}
