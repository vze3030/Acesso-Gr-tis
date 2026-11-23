import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  BookmarkPlus,
  AlertTriangle,
  User,
  FileText,
} from 'lucide-react';
import { SharePayload } from '../types';
import { formatPtBrDateTime, getAvatarColorClass, getInitials } from '../utils/storage';

interface RevealViewProps {
  payload: SharePayload | null;
  onExitReveal: () => void;
  onSaveCopyToDevice: (payload: SharePayload) => void;
  onNotify: (message: string) => void;
}

export const RevealView: React.FC<RevealViewProps> = ({
  payload,
  onExitReveal,
  onSaveCopyToDevice,
  onNotify,
}) => {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [savedCopy, setSavedCopy] = useState(false);

  const handleCopy = async (value: string, field: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      onNotify(
        field === 'email'
          ? 'E-mail/usuário copiado!'
          : 'Login/senha copiado!'
      );
      setTimeout(() => setCopiedField(null), 2200);
    } catch {
      onNotify('Não foi possível copiar automaticamente.');
    }
  };

  if (!payload) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-xl bg-white p-6 sm:p-8 shadow-sm border border-[#DADDE1] text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[#1C1E21]">
            Link de revelação inválido ou incompleto
          </h1>
          <p className="text-sm text-[#65676B] leading-relaxed">
            Não foi possível decodificar as informações deste link. Peça para a
            pessoa gerar um novo link de compartilhamento pelo Acesso Grátis.
          </p>
          <button
            type="button"
            onClick={onExitReveal}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Voltar ao Acesso Grátis</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-4">
        <button
          type="button"
          onClick={onExitReveal}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#1877F2] hover:bg-white hover:shadow-xs transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar para o Acesso Grátis</span>
        </button>
      </div>

      <article className="rounded-xl bg-white shadow-md border border-[#DADDE1] overflow-hidden">
        {/* Top Highlight Banner */}
        <div className="bg-[#1877F2] px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">
                  {payload.t}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Sender Metadata */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EBEDF0] bg-[#F7F8FA] px-6 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColorClass(
                payload.n
              )}`}
            >
              {getInitials(payload.n)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1C1E21] truncate flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#65676B] shrink-0" aria-hidden="true" />
                <span>Compartilhado por {payload.n}</span>
              </p>
              {payload.d && (
                <p className="text-xs text-[#65676B]">
                  Registrado em {formatPtBrDateTime(payload.d)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Revealed Credentials */}
        <div className="p-6 space-y-4">
          {/* Email / User */}
          <div className="rounded-lg border border-[#DADDE1] bg-[#F5F6F7] p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-[#65676B]">
                E-mail ou Usuário
              </span>
              <button
                type="button"
                onClick={() => handleCopy(payload.e, 'email')}
                disabled={!payload.e}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-[#1877F2] hover:bg-[#E7F3FF] transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-sm sm:text-base font-medium text-[#1C1E21] break-all">
              {payload.e || 'Não informado'}
            </p>
          </div>

          {/* Password / Login */}
          <div className="rounded-lg border border-[#DADDE1] bg-[#F5F6F7] p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-[#65676B]">
                Login / Senha de Acesso
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-[#65676B] hover:bg-[#E4E6EB] hover:text-[#1C1E21] transition-colors whitespace-nowrap"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ocultar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Mostrar</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(payload.p, 'password')}
                  disabled={!payload.p}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-[#1877F2] hover:bg-[#E7F3FF] transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {copiedField === 'password' ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="font-mono text-sm sm:text-base font-medium text-[#1C1E21] break-all">
              {payload.p
                ? showPassword
                  ? payload.p
                  : '•'.repeat(Math.min(payload.p.length, 16))
                : 'Não informado'}
            </p>
          </div>

          {/* Notes */}
          {payload.o && (
            <div className="rounded-lg border border-[#DADDE1] bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#65676B] mb-1">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Observações</span>
              </div>
              <p className="text-sm text-[#1C1E21] whitespace-pre-wrap leading-relaxed">
                {payload.o}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={savedCopy}
              onClick={() => {
                onSaveCopyToDevice(payload);
                setSavedCopy(true);
              }}
              className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#166FE5] disabled:bg-[#31A24C] transition-colors whitespace-nowrap"
            >
              {savedCopy ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>Salvo no seu dispositivo</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Guardar nos meus cartões</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onExitReveal}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#CCD0D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1E21] hover:bg-[#F0F2F5] transition-colors whitespace-nowrap"
            >
              <span>Abrir meu painel</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
};
