import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { AccessCard } from '../types';
import { buildShareUrl } from '../utils/storage';

interface ShareModalProps {
  card: AccessCard | null;
  onClose: () => void;
  onPreviewReveal: (shareUrl: string) => void;
  onNotify: (message: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  card,
  onClose,
  onPreviewReveal,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [card?.id]);

  useEffect(() => {
    if (!card) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [card, onClose]);

  if (!card) return null;

  const shareUrl = buildShareUrl(card);
  const shareMessage = `Olá! Compartilhei os dados de acesso da conta "${card.accountTitle}" (${card.ownerName}) pelo Acesso Grátis. Abra o link para visualizar:\n\n${shareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const emailSubject = `Acesso compartilhado: ${card.accountTitle} (${card.ownerName})`;
  const emailHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(shareMessage)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onNotify('Link de compartilhamento copiado!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('Não foi possível copiar automaticamente. Selecione o link acima.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-[#DADDE1] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#EBEDF0] px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7F3FF] text-[#1877F2]">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-modal-title"
                className="text-base font-bold text-[#1C1E21] truncate"
              >
                Acesso
              </h2>
              <p className="text-xs text-[#65676B] truncate">
                {card.accountTitle} · {card.ownerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de compartilhamento"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#65676B] hover:bg-[#F0F2F5] hover:text-[#1C1E21] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <label
              htmlFor="share-url-input"
              className="block text-xs font-semibold text-[#65676B] mb-1.5"
            >
              Link exclusivo de revelação
            </label>
            <div className="flex items-center gap-2">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="w-full min-h-[42px] rounded-lg border border-[#CCD0D5] bg-[#F5F6F7] px-3 py-2 font-mono text-xs text-[#1C1E21] focus:border-[#1877F2] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1EBE5D] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Enviar pelo WhatsApp</span>
            </a>

            <a
              href={emailHref}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#CCD0D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1E21] hover:bg-[#F0F2F5] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2"
            >
              <Mail className="h-4 w-4 shrink-0 text-[#1877F2]" aria-hidden="true" />
              <span>Enviar por E-mail</span>
            </a>
          </div>

          <div className="border-t border-[#EBEDF0] pt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onPreviewReveal(shareUrl)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1877F2] hover:text-[#166FE5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] rounded"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Visualizar tela de revelação agora</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-xs font-semibold text-[#65676B] hover:bg-[#F0F2F5] hover:text-[#1C1E21] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
