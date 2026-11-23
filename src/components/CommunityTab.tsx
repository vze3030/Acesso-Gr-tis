import React, { useState, useMemo } from 'react';
import {
  BadgeCheck,
  Search,
  Users,
  Clock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { CommunityMember } from '../types';
import {
  formatPtBrDateTime,
  getAvatarColorClass,
  getInitials,
} from '../utils/storage';

interface CommunityTabProps {
  members: CommunityMember[];
  totalRegistered: number | null;
  isLoading: boolean;
  onGoToSave: () => void;
}

export const CommunityTab: React.FC<CommunityTabProps> = ({
  members,
  totalRegistered,
  isLoading,
  onGoToSave,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return members;
    return members.filter((m) => m.nick.toLowerCase().includes(query));
  }, [members, searchTerm]);

  return (
    <section aria-labelledby="community-heading" className="space-y-5">
      {/* Header Banner Card */}
      <div className="rounded-xl bg-white p-5 sm:p-6 shadow-sm border border-[#DADDE1]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1877F2]">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Área Pública da Comunidade</span>
            </div>
            <h2
              id="community-heading"
              className="text-xl sm:text-2xl font-bold text-[#1C1E21]"
            >
              Membros Registrados no Acesso Grátis
            </h2>
            <p className="text-sm text-[#65676B]">
              {totalRegistered === null ? (
                <span>Carregando registros reais da comunidade...</span>
              ) : (
                <>
                  Total real de{' '}
                  <strong className="font-semibold text-[#1C1E21] tabular-nums">
                    {totalRegistered.toLocaleString('pt-BR')}
                  </strong>{' '}
                  {totalRegistered === 1
                    ? 'cadastro confirmado.'
                    : 'cadastros confirmados.'}{' '}
                  Apenas o nome ou apelido público é exibido neste mural.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65676B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar membro por nome..."
                aria-label="Buscar membro por nome ou apelido"
                className="w-full sm:w-64 min-h-[42px] rounded-lg border border-[#CCD0D5] bg-[#F0F2F5] pl-9 pr-3 py-2 text-sm text-[#1C1E21] placeholder:text-[#65676B] focus:border-[#1877F2] focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={onGoToSave}
              className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors whitespace-nowrap shrink-0"
            >
              Cadastrar meu nome
            </button>
          </div>
        </div>
      </div>

      {/* Loading / Empty / Members Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-sm border border-[#DADDE1] animate-pulse"
            >
              <div className="h-12 w-12 shrink-0 rounded-full bg-[#E4E6EB]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-[#E4E6EB]" />
                <div className="h-3 w-24 rounded bg-[#F0F2F5]" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm border border-[#DADDE1] space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F3FF] text-[#1877F2]">
            <UserPlus className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-[#1C1E21]">
            Ainda não há membros registrados na comunidade
          </h3>
          <p className="mx-auto max-w-md text-sm text-[#65676B] leading-relaxed">
            Este mural exibe somente registros reais feitos pelos usuários.
            Cadastre seu nome na aba Salvar e Compartilhar para garantir o acesso
            ao site.
          </p>
          <button
            type="button"
            onClick={onGoToSave}
            className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#1877F2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#166FE5] transition-colors"
          >
            Fazer primeiro registro
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm border border-[#DADDE1] space-y-3">
          <p className="text-base font-semibold text-[#1C1E21]">
            Nenhum membro encontrado para "{searchTerm}"
          </p>
          <p className="text-sm text-[#65676B]">
            Tente outro nome ou limpe a busca para visualizar os registros recentes.
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[#CCD0D5] bg-white px-4 py-2 text-sm font-semibold text-[#1C1E21] hover:bg-[#F0F2F5] transition-colors"
          >
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredMembers.map((member, index) => {
            const initials = getInitials(member.nick);
            const avatarColor = getAvatarColorClass(member.nick);
            const isNewest = index === 0 && !searchTerm;

            return (
              <article
                key={member.id}
                className="flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-sm border border-[#DADDE1] hover:border-[#BCC0C4] transition-colors"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-tight ${avatarColor}`}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[#1C1E21] truncate">
                      {member.nick}
                    </h3>
                    {member.verified && (
                      <BadgeCheck
                        className="h-4 w-4 shrink-0 text-[#1877F2]"
                        aria-label="Membro Verificado"
                      />
                    )}
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#1877F2] font-medium">
                    <span>Membro Verificado</span>
                    {isNewest && (
                      <>
                        <span className="text-[#8A8D91]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[#31A24C] font-semibold">
                          Mais recente
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-xs text-[#65676B] tabular-nums">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {formatPtBrDateTime(member.registeredAt)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Privacy reminder inside public wall */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#65676B] pt-1">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#31A24C]" aria-hidden="true" />
        <span>
          Privacidade garantida: e-mails e senhas nunca são enviados para esta lista pública.
        </span>
      </div>
    </section>
  );
};
