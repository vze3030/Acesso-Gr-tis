import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  KeyRound,
  Lock,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Share2,
  PlusCircle,
  ShieldCheck,
  BookmarkCheck,
  UserCheck,
  FileText,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { AccessCard, ActiveTab, CommunityMember, SharePayload } from './types';
import {
  decodeSharePayload,
  formatPtBrDateTime,
  loadPrivateCards,
  savePrivateCards,
} from './utils/storage';
import { ShareModal } from './components/ShareModal';
import { RevealView } from './components/RevealView';
import { CommunityTab } from './components/CommunityTab';

const ACCOUNT_PRESETS = ['Facebook', 'Instagram', 'WhatsApp', 'E-mail'];
const PRESENCE_WINDOW_MS = 55_000;
const PRESENCE_HEARTBEAT_MS = 20_000;
const SESSION_STORAGE_KEY = 'acesso_gratis_session_id';

interface PresenceEntry {
  id: string;
  lastSeenMs: number;
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const nextId = `tab_${randomPart}`.slice(0, 64);
    sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

function extractRevealHash(hash: string): string | null {
  if (!hash || !hash.startsWith('#revelar=')) return null;
  const raw = hash.slice('#revelar='.length).trim();
  return raw || null;
}

export default function App() {
  // Navigation & Reveal Mode state
  const [activeTab, setActiveTab] = useState<ActiveTab>('private');
  const [revealToken, setRevealToken] = useState<string | null>(() =>
    extractRevealHash(window.location.hash)
  );

  // Private local cards (stay ONLY in user's browser LocalStorage)
  const [privateCards, setPrivateCards] = useState<AccessCard[]>(() =>
    loadPrivateCards()
  );

  // Real Firestore-synced community & presence state
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [totalRegistered, setTotalRegistered] = useState<number | null>(null);
  const [isCommunityLoading, setIsCommunityLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const presenceEntriesRef = useRef<PresenceEntry[]>([]);

  // Form state
  const [ownerName, setOwnerName] = useState('');
  const [accountTitle, setAccountTitle] = useState('Facebook');
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Card UI states
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedCardField, setCopiedCardField] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareCard, setShareCard] = useState<AccessCard | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Listen to URL hash changes for #revelar=...
  useEffect(() => {
    const handleHashChange = () => {
      setRevealToken(extractRevealHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 1. Real-Time Online Presence via Firestore (works in AI Studio, GitHub, and Vercel)
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const presenceDocRef = doc(db, 'presence', sessionId);
    const presencePath = `presence/${sessionId}`;
    let isDisposed = false;

    const recomputeOnlineCount = () => {
      const cutoff = Date.now() - PRESENCE_WINDOW_MS;
      const activeSessions = presenceEntriesRef.current.filter(
        (entry) => entry.lastSeenMs >= cutoff || entry.id === sessionId
      );
      setOnlineCount(Math.max(1, activeSessions.length));
    };

    const sendHeartbeat = async () => {
      if (isDisposed) return;
      try {
        await setDoc(presenceDocRef, {
          active: true,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, presencePath);
      }
    };

    const removePresence = () => {
      deleteDoc(presenceDocRef).catch(() => {
        // Best effort on page unload; stale sessions expire after PRESENCE_WINDOW_MS
      });
    };

    sendHeartbeat();

    const heartbeatTimer = window.setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_MS);
    const expirationTimer = window.setInterval(recomputeOnlineCount, 10_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', removePresence);

    const presenceQuery = query(
      collection(db, 'presence'),
      where('lastSeen', '>=', Timestamp.fromMillis(0)),
      orderBy('lastSeen', 'desc'),
      limit(200)
    );

    const unsubscribePresence = onSnapshot(
      presenceQuery,
      (snapshot) => {
        const nowMs = Date.now();
        presenceEntriesRef.current = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const lastSeen = data.lastSeen as Timestamp | null | undefined;
          return {
            id: docSnap.id,
            lastSeenMs: lastSeen ? lastSeen.toMillis() : nowMs,
          };
        });
        recomputeOnlineCount();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'presence');
      }
    );

    return () => {
      isDisposed = true;
      window.clearInterval(heartbeatTimer);
      window.clearInterval(expirationTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', removePresence);
      unsubscribePresence();
      removePresence();
    };
  }, []);

  // 2. Real-Time Registered Community Members via Firestore
  useEffect(() => {
    const membersQuery = query(
      collection(db, 'community_members'),
      where('createdAt', '>=', Timestamp.fromMillis(0)),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribeMembers = onSnapshot(
      membersQuery,
      async (snapshot) => {
        const mapped: CommunityMember[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt as Timestamp | null | undefined;
          return {
            id: docSnap.id,
            nick: typeof data.nick === 'string' ? data.nick : 'Membro',
            registeredAt: createdAt
              ? createdAt.toDate().toISOString()
              : new Date().toISOString(),
            verified: Boolean(data.verified),
          };
        });

        setCommunityMembers(mapped);
        setIsCommunityLoading(false);

        if (mapped.length < 200) {
          setTotalRegistered(mapped.length);
        } else {
          try {
            const countQuery = query(
              collection(db, 'community_members'),
              where('createdAt', '>=', Timestamp.fromMillis(0))
            );
            const countSnap = await getCountFromServer(countQuery);
            setTotalRegistered(countSnap.data().count);
          } catch {
            setTotalRegistered(mapped.length);
          }
        }
      },
      (error) => {
        setIsCommunityLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'community_members');
      }
    );

    return () => unsubscribeMembers();
  }, []);

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = ownerName.trim().slice(0, 80);
    const trimmedTitle = accountTitle.trim() || 'Facebook';
    const trimmedEmail = emailOrUser.trim();
    const trimmedPassword = password;

    if (!trimmedName) {
      setFormError('Por favor, informe seu Nome, Apelido ou Nick.');
      return;
    }

    if (!trimmedEmail && !trimmedPassword) {
      setFormError('Informe pelo menos o e-mail/usuário ou o login/senha da conta.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    const nowIso = new Date().toISOString();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const memberId = `member_${uniqueId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // 1. Save full card ONLY to user's private LocalStorage
    const newCard: AccessCard = {
      id: uniqueId,
      communityMemberId: memberId,
      ownerName: trimmedName,
      accountTitle: trimmedTitle,
      emailOrUser: trimmedEmail,
      password: trimmedPassword,
      notes: '',
      createdAt: nowIso,
    };

    const updatedCards = [newCard, ...privateCards];
    setPrivateCards(updatedCards);
    savePrivateCards(updatedCards);

    // 2. Publish ONLY public Nick + serverTimestamp to Firestore (never email/password)
    const memberPath = `community_members/${memberId}`;
    try {
      await setDoc(doc(db, 'community_members', memberId), {
        nick: trimmedName,
        verified: true,
        createdAt: serverTimestamp(),
      });
      showToast(
        `Cartão salvo no seu dispositivo! "${trimmedName}" registrado na comunidade.`
      );
    } catch (error) {
      showToast(
        'Cartão salvo no dispositivo, mas houve um erro ao registrar na comunidade.'
      );
      handleFirestoreError(error, OperationType.CREATE, memberPath);
    } finally {
      setIsSubmitting(false);
    }

    // Reset form fields (keep Facebook pre-selected as default account title)
    setOwnerName('');
    setAccountTitle('Facebook');
    setEmailOrUser('');
    setPassword('');
    setShowFormPassword(false);
  };

  const toggleCardPassword = (cardId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleCopyCardField = async (
    value: string,
    key: string,
    label: string
  ) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCardField(key);
      showToast(`${label} copiado para a área de transferência!`);
      setTimeout(() => setCopiedCardField(null), 2000);
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    const targetCard = privateCards.find((c) => c.id === cardId);
    const updated = privateCards.filter((c) => c.id !== cardId);
    setPrivateCards(updated);
    savePrivateCards(updated);
    setConfirmDeleteId(null);

    if (targetCard && !targetCard.id.startsWith('shared-')) {
      const memberId =
        targetCard.communityMemberId ||
        `member_${targetCard.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
      const memberPath = `community_members/${memberId}`;
      try {
        await deleteDoc(doc(db, 'community_members', memberId));
        showToast('Acesso excluído e removido da lista de registros!');
      } catch (error) {
        showToast(
          'Cartão excluído do dispositivo, mas houve um erro ao remover da lista pública.'
        );
        handleFirestoreError(error, OperationType.DELETE, memberPath);
      }
    } else {
      showToast('Cartão removido do seu dispositivo.');
    }
  };

  const handleExitReveal = () => {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`
    );
    setRevealToken(null);
  };

  const handlePreviewReveal = (shareUrl: string) => {
    const hashIndex = shareUrl.indexOf('#revelar=');
    if (hashIndex !== -1) {
      const nextHash = shareUrl.slice(hashIndex);
      window.location.hash = nextHash;
      setRevealToken(extractRevealHash(nextHash));
      setShareCard(null);
    }
  };

  const handleSaveCopyFromReveal = (payload: SharePayload) => {
    const nowIso = new Date().toISOString();
    const newCard: AccessCard = {
      id: `shared-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerName: payload.n,
      accountTitle: payload.t,
      emailOrUser: payload.e,
      password: payload.p,
      notes: payload.o || '',
      createdAt: payload.d || nowIso,
    };
    const updated = [newCard, ...privateCards];
    setPrivateCards(updated);
    savePrivateCards(updated);
    showToast('Cópia salva com segurança nos seus cartões privados!');
  };

  const decodedRevealPayload = revealToken
    ? decodeSharePayload(revealToken)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F0F2F5] text-[#1C1E21]">
      {/* Blue Header ("Acesso Grátis") */}
      <header className="bg-[#1877F2] text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 h-16">
          <button
            type="button"
            onClick={() => {
              if (revealToken) handleExitReveal();
              setActiveTab('private');
            }}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg py-1"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1877F2] shadow-xs">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0">
              Acesso Grátis
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-white/90">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">
              Cofre Local &amp; Comunidade
            </span>
          </div>
        </div>
      </header>

      {/* Real-Time Social Proof Status Bar */}
      <div className="border-b border-[#DADDE1] bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
          {/* Indicator 1: Real Online Agora via Firestore presence */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              {onlineCount !== null && onlineCount > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#31A24C] opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  onlineCount !== null ? 'bg-[#31A24C]' : 'bg-[#8A8D91]'
                }`}
              />
            </span>
            <span className="text-xs sm:text-sm font-medium text-[#65676B]">
              Online Agora:
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#1C1E21] tabular-nums">
              {onlineCount === null
                ? 'Conectando...'
                : `${onlineCount} ${onlineCount === 1 ? 'pessoa' : 'pessoas'}`}
            </span>
          </div>

          {/* Indicator 2: Real Total de Registrados via Firestore */}
          <div className="flex items-center gap-2">
            <UserCheck
              className="h-4 w-4 shrink-0 text-[#1877F2]"
              aria-hidden="true"
            />
            <span className="text-xs sm:text-sm font-medium text-[#65676B]">
              Total de Registrados:
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#1877F2] tabular-nums">
              {totalRegistered === null
                ? '...'
                : totalRegistered.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content or Reveal Mode */}
      {revealToken !== null ? (
        <main className="flex-1">
          <RevealView
            payload={decodedRevealPayload}
            onExitReveal={handleExitReveal}
            onSaveCopyToDevice={handleSaveCopyFromReveal}
            onNotify={showToast}
          />
        </main>
      ) : (
        <>
          {/* Two-Tab Navigation Menu */}
          <nav
            aria-label="Navegação principal"
            className="border-b border-[#DADDE1] bg-white shadow-2xs sticky top-0 z-30"
          >
            <div className="mx-auto flex max-w-5xl px-2 sm:px-6 gap-1 sm:gap-4 overflow-x-auto">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'private'}
                onClick={() => setActiveTab('private')}
                className={`relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 min-h-[48px] px-2 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1877F2] ${
                  activeTab === 'private'
                    ? 'text-[#1877F2]'
                    : 'text-[#65676B] hover:bg-[#F0F2F5] hover:text-[#1C1E21]'
                }`}
              >
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
                <span>Salvar e Compartilhar</span>
                {privateCards.length > 0 && (
                  <span className="ml-0.5 text-[11px] sm:text-xs font-bold tabular-nums opacity-80">
                    ({privateCards.length})
                  </span>
                )}
                {activeTab === 'private' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#1877F2]" />
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'community'}
                onClick={() => setActiveTab('community')}
                className={`relative flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 min-h-[48px] px-2 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1877F2] ${
                  activeTab === 'community'
                    ? 'text-[#1877F2]'
                    : 'text-[#65676B] hover:bg-[#F0F2F5] hover:text-[#1C1E21]'
                }`}
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden="true" />
                <span>Comunidade / Registrados</span>
                {totalRegistered !== null && (
                  <span className="ml-1 text-xs font-bold tabular-nums opacity-80">
                    ({totalRegistered.toLocaleString('pt-BR')})
                  </span>
                )}
                {activeTab === 'community' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#1877F2]" />
                )}
              </button>
            </div>
          </nav>

          {/* Active Tab Viewport */}
          <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
            {activeTab === 'private' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Registration Form */}
                <section
                  aria-labelledby="form-section-title"
                  className="lg:col-span-5 rounded-xl bg-white p-5 sm:p-6 shadow-sm border border-[#DADDE1]"
                >
                  <div className="mb-5">
                    <h1
                      id="form-section-title"
                      className="text-lg sm:text-xl font-bold text-[#1C1E21]"
                    >
                      Novo Acesso
                    </h1>
                  </div>

                  <form onSubmit={handleSaveCard} className="space-y-4" noValidate>
                    {formError && (
                      <div
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
                      >
                        {formError}
                      </div>
                    )}

                    {/* Campo 1: Seu Nome, Apelido ou Nick (Obrigatório) */}
                    <div>
                      <label
                        htmlFor="owner-name"
                        className="block text-xs font-semibold text-[#1C1E21] mb-1.5"
                      >
                        Seu Nome, Apelido ou Nick{' '}
                        <span className="text-red-600" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <input
                        id="owner-name"
                        type="text"
                        required
                        maxLength={80}
                        value={ownerName}
                        onChange={(e) => {
                          setOwnerName(e.target.value);
                          if (formError) setFormError(null);
                        }}
                        placeholder="Ex: João Silva ou Joao_RJ"
                        className="w-full min-h-[44px] rounded-lg border border-[#CCD0D5] bg-[#F5F6F7] px-3.5 py-2 text-sm text-[#1C1E21] placeholder:text-[#8A8D91] focus:border-[#1877F2] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Campo 2: Título da Conta (com sugestão/pré-seleção de Facebook) */}
                    <div>
                      <label
                        htmlFor="account-title"
                        className="block text-xs font-semibold text-[#1C1E21] mb-1.5"
                      >
                        Título da Conta
                      </label>
                      <input
                        id="account-title"
                        type="text"
                        value={accountTitle}
                        onChange={(e) => setAccountTitle(e.target.value)}
                        placeholder="Facebook"
                        className="w-full min-h-[44px] rounded-lg border border-[#CCD0D5] bg-[#F5F6F7] px-3.5 py-2 text-sm text-[#1C1E21] placeholder:text-[#8A8D91] focus:border-[#1877F2] focus:bg-white focus:outline-none transition-colors"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ACCOUNT_PRESETS.map((preset) => {
                          const isSelected = accountTitle === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setAccountTitle(preset)}
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                                isSelected
                                  ? 'bg-[#E7F3FF] text-[#1877F2]'
                                  : 'bg-[#F0F2F5] text-[#65676B] hover:bg-[#E4E6EB] hover:text-[#1C1E21]'
                              }`}
                            >
                              {preset}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Campo 3: E-mail ou Usuário */}
                    <div>
                      <label
                        htmlFor="email-user"
                        className="block text-xs font-semibold text-[#1C1E21] mb-1.5"
                      >
                        E-mail ou Usuário
                      </label>
                      <input
                        id="email-user"
                        type="text"
                        value={emailOrUser}
                        onChange={(e) => {
                          setEmailOrUser(e.target.value);
                          if (formError) setFormError(null);
                        }}
                        placeholder="seuemail@exemplo.com ou telefone"
                        className="w-full min-h-[44px] rounded-lg border border-[#CCD0D5] bg-[#F5F6F7] px-3.5 py-2 text-sm text-[#1C1E21] placeholder:text-[#8A8D91] focus:border-[#1877F2] focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Campo 4: Login / Senha de Acesso (com mostrar/ocultar) */}
                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold text-[#1C1E21] mb-1.5"
                      >
                        Login / Senha de Acesso
                      </label>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showFormPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (formError) setFormError(null);
                          }}
                          placeholder="Digite a senha ou código de acesso"
                          className="w-full min-h-[44px] rounded-lg border border-[#CCD0D5] bg-[#F5F6F7] pl-3.5 pr-11 py-2 font-mono text-sm text-[#1C1E21] placeholder:font-sans placeholder:text-[#8A8D91] focus:border-[#1877F2] focus:bg-white focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword((prev) => !prev)}
                          aria-label={
                            showFormPassword
                              ? 'Ocultar senha'
                              : 'Mostrar senha'
                          }
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#65676B] hover:bg-[#E4E6EB] hover:text-[#1C1E21] transition-colors"
                        >
                          {showFormPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#166FE5] disabled:opacity-60 active:scale-[0.99] transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {isSubmitting
                          ? 'Salvando...'
                          : 'Salvar Acesso e Registrar Nome'}
                      </span>
                    </button>
                  </form>
                </section>

                {/* Right Column: Meus Cartões Salvos */}
                <section
                  aria-labelledby="saved-cards-title"
                  className="lg:col-span-7 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div>
                      <h2
                        id="saved-cards-title"
                        className="text-lg font-bold text-[#1C1E21]"
                      >
                        Meus Cartões Salvos
                      </h2>
                      <p className="text-xs text-[#65676B]">
                        Visível apenas neste dispositivo. Clique em Compartilhar
                        Link para gerar uma URL segura.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#65676B] tabular-nums shrink-0">
                      {privateCards.length}{' '}
                      {privateCards.length === 1 ? 'cartão' : 'cartões'}
                    </span>
                  </div>

                  {privateCards.length === 0 ? (
                    <div className="rounded-xl bg-white p-8 sm:p-10 text-center shadow-sm border border-[#DADDE1] space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F3FF] text-[#1877F2]">
                        <BookmarkCheck className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-bold text-[#1C1E21]">
                        Nenhum cartão salvo neste dispositivo ainda
                      </h3>
                      <p className="mx-auto max-w-md text-sm text-[#65676B] leading-relaxed">
                        Preencha o formulário ao lado para memorizar seu e-mail
                        e senha do Facebook. Seus dados ficam guardados apenas no
                        seu navegador e seu apelido aparece na aba Comunidade.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {privateCards.map((card) => {
                        const isPasswordVisible = !!visiblePasswords[card.id];
                        const isConfirmingDelete = confirmDeleteId === card.id;

                        return (
                          <article
                            key={card.id}
                            className="rounded-xl bg-white p-5 shadow-sm border border-[#DADDE1] space-y-4"
                          >
                            {/* Card Header */}
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EBEDF0] pb-3.5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs text-[#65676B]">
                                  <span className="font-semibold text-[#1877F2]">
                                    {card.accountTitle}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    {formatPtBrDateTime(card.createdAt)}
                                  </span>
                                </div>
                                <h3 className="mt-0.5 text-base font-bold text-[#1C1E21] truncate">
                                  {card.ownerName}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setShareCard(card)}
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#E7F3FF] px-3 py-1.5 text-xs font-bold text-[#1877F2] hover:bg-[#D8EBFF] transition-colors whitespace-nowrap"
                                >
                                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Compartilhar Link</span>
                                </button>

                                {isConfirmingDelete ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCard(card.id)}
                                      className="inline-flex min-h-[38px] items-center rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="inline-flex min-h-[38px] items-center rounded-lg bg-[#F0F2F5] px-2.5 py-1.5 text-xs font-semibold text-[#65676B] hover:bg-[#E4E6EB] transition-colors whitespace-nowrap"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(card.id)}
                                    aria-label={`Excluir cartão de ${card.accountTitle}`}
                                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-[#65676B] hover:bg-red-50 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Credentials Rows */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Email / User */}
                              <div className="rounded-lg bg-[#F5F6F7] px-3.5 py-2.5 border border-[#EBEDF0]">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[11px] font-semibold text-[#65676B]">
                                    E-mail ou Usuário
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!card.emailOrUser}
                                    onClick={() =>
                                      handleCopyCardField(
                                        card.emailOrUser,
                                        `${card.id}-email`,
                                        'E-mail/usuário'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1877F2] hover:underline disabled:opacity-40 whitespace-nowrap"
                                  >
                                    {copiedCardField === `${card.id}-email` ? (
                                      <>
                                        <Check className="h-3 w-3" aria-hidden="true" />
                                        <span>Copiado</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" aria-hidden="true" />
                                        <span>Copiar</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <p className="font-mono text-xs sm:text-sm text-[#1C1E21] break-all">
                                  {card.emailOrUser || '—'}
                                </p>
                              </div>

                              {/* Login / Password */}
                              <div className="rounded-lg bg-[#F5F6F7] px-3.5 py-2.5 border border-[#EBEDF0]">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[11px] font-semibold text-[#65676B]">
                                    Login / Senha
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!card.password}
                                      onClick={() => toggleCardPassword(card.id)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#65676B] hover:text-[#1C1E21] disabled:opacity-40 whitespace-nowrap"
                                    >
                                      {isPasswordVisible ? (
                                        <>
                                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                                          <span>Ocultar</span>
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-3 w-3" aria-hidden="true" />
                                          <span>Ver</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!card.password}
                                      onClick={() =>
                                        handleCopyCardField(
                                          card.password,
                                          `${card.id}-pass`,
                                          'Login/senha'
                                        )
                                      }
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1877F2] hover:underline disabled:opacity-40 whitespace-nowrap"
                                    >
                                      {copiedCardField === `${card.id}-pass` ? (
                                        <>
                                          <Check className="h-3 w-3" aria-hidden="true" />
                                          <span>Copiado</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3 w-3" aria-hidden="true" />
                                          <span>Copiar</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <p className="font-mono text-xs sm:text-sm text-[#1C1E21] break-all">
                                  {card.password
                                    ? isPasswordVisible
                                      ? card.password
                                      : '•'.repeat(Math.min(card.password.length, 14))
                                    : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Optional Notes (for older saved cards) */}
                            {card.notes && (
                              <div className="flex items-start gap-2 rounded-lg bg-[#F7F8FA] px-3 py-2 text-xs text-[#4B4F56]">
                                <FileText
                                  className="h-3.5 w-3.5 shrink-0 text-[#65676B] mt-0.5"
                                  aria-hidden="true"
                                />
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {card.notes}
                                </p>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <CommunityTab
                members={communityMembers}
                totalRegistered={totalRegistered}
                isLoading={isCommunityLoading}
                onGoToSave={() => setActiveTab('private')}
              />
            )}
          </main>
        </>
      )}

      {/* Share Modal */}
      <ShareModal
        card={shareCard}
        onClose={() => setShareCard(null)}
        onPreviewReveal={handlePreviewReveal}
        onNotify={showToast}
      />

      {/* Non-intrusive Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl bg-[#1C1E21] px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-lg"
        >
          <Check className="h-4 w-4 shrink-0 text-[#31A24C]" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
