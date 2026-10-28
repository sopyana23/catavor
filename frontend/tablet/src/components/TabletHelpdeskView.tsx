import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  HelpCircle,
  Scale,
  Plus,
  Search,
  MessageSquare,
  Paperclip,
  Send,
  Star,
  Phone,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Eye,
  Download,
  Loader,
  FileText,
  X,
  Store,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { TabletMasterDetailView } from './TabletMasterDetailView';
import { DocumentPreviewModal, type DocumentPreviewData } from './DocumentPreviewModal';

export interface TicketAttachment {
  id?: number | string;
  file_url: string;
  storage_key?: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
}

export interface TicketMessage {
  id: string | number;
  sender: 'user' | 'support' | 'agent' | 'system';
  sender_name?: string;
  message: string;
  timestamp?: string;
  created_at?: string;
  read_at?: string | null;
  attachments?: TicketAttachment[];
}

export interface SupportTicket {
  id: string | number;
  ticket_number?: string;
  store_id?: number | null;
  store_slug?: string;
  store?: {
    id: number;
    name: string;
    slug: string;
    plan?: string;
    logo?: string;
  } | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  messages: TicketMessage[];
  unread_count?: number;
  has_unread?: boolean;
  rating?: number;
  rating_comment?: string;
  rated_at?: string;
}

export interface TabletHelpdeskViewProps {
  token: string;
  storeSlug: string;
  settings?: any;
  currentUser?: any;
  userStores?: any[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | string) => void;
  onUpdateUnreadCount?: (count: number) => void;
}

export const TabletHelpdeskView: React.FC<TabletHelpdeskViewProps> = ({
  token,
  storeSlug,
  settings = {},
  currentUser,
  userStores = [],
  showToast,
  onUpdateUnreadCount
}) => {
  // Check dormancy / suspended account mode
  const isSuspendedAccount = settings?.dormancy_status === 'suspended' || settings?.is_suspended;

  // Tickets List & Filtering States
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | number | 'new' | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tParam = urlParams.get('ticket');
        if (tParam) return tParam;
      } catch {}
    }
    return null;
  });

  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState<boolean>(false);
  const [ticketDetails, setTicketDetails] = useState<SupportTicket | null>(null);

  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState<string>('');
  const [ticketPage, setTicketPage] = useState<number>(1);
  const [ticketTotalPages, setTicketTotalPages] = useState<number>(1);
  const [ticketTotalItems, setTicketTotalItems] = useState<number>(0);
  const [ticketLimit] = useState<number>(15);
  const [ticketMetrics, setTicketMetrics] = useState<{ total: number; active: number; resolved: number }>({
    total: 0,
    active: 0,
    resolved: 0
  });

  // Reply Form States
  const [ticketReplyText, setTicketReplyText] = useState<string>('');
  const [ticketReplyAttachments, setTicketReplyAttachments] = useState<TicketAttachment[]>([]);
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  // Create Ticket Form States
  const [newTicketForm, setNewTicketForm] = useState<{
    subject: string;
    category: string;
    priority: string;
    message: string;
  }>({
    subject: '',
    category: 'technical',
    priority: 'normal',
    message: ''
  });
  const [ticketNewAttachments, setTicketNewAttachments] = useState<TicketAttachment[]>([]);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);

  // CSAT Rating States
  const [csatRating, setCsatRating] = useState<number>(5);
  const [csatComment, setCsatComment] = useState<string>('');
  const [isSubmittingCSAT, setIsSubmittingCSAT] = useState<boolean>(false);

  // Document & Lightbox Preview States
  const [docPreview, setDocPreview] = useState<DocumentPreviewData | null>(null);
  const [activeImageLightbox, setActiveImageLightbox] = useState<string | null>(null);

  // References
  const readTicketIdsRef = useRef<Set<string | number>>(new Set());
  const prevTicketMessagesRef = useRef<Record<string, number>>({});
  const isFirstTicketLoadRef = useRef<boolean>(true);
  const isFetchingTicketsRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio Chime Synthesizer
  const playSupportChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.33);
    } catch {}
  }, []);

  // Helper: Auth Headers
  const getAuthHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
  }), [token, storeSlug]);

  // Support Attachment URL Helper
  const supportAttachmentSrc = (att: any): string => {
    if (!att) return '';
    if (att.id) return `/api/support/attachments/${att.id}`;
    return att.file_url || '';
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTicketSearch(ticketSearch);
      setTicketPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [ticketSearch]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setTicketPage(1);
  }, [ticketFilter]);

  // Sync CSAT initial values when ticket details change
  useEffect(() => {
    if (ticketDetails) {
      setCsatRating(ticketDetails.rating || 5);
      setCsatComment(ticketDetails.rating_comment || '');
    }
  }, [ticketDetails?.id, ticketDetails?.rating, ticketDetails?.rating_comment]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (ticketDetails?.messages?.length) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 120);
    }
  }, [ticketDetails?.id, ticketDetails?.messages?.length]);

  // 1. Fetch tickets list
  const fetchSupportTickets = useCallback(async (silent: boolean = false, pageToFetch: number = ticketPage) => {
    if (!token) return;
    if (isFetchingTicketsRef.current) return;
    isFetchingTicketsRef.current = true;

    try {
      if (!silent) setLoadingTickets(true);
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(pageToFetch));
      queryParams.set('limit', String(ticketLimit));

      if (ticketFilter !== 'all') {
        queryParams.set('status', ticketFilter);
      }
      if (debouncedTicketSearch.trim()) {
        queryParams.set('q', debouncedTicketSearch.trim());
      }
      if (storeSlug) {
        queryParams.set('store_slug', storeSlug);
      }

      const res = await fetch(`/api/support/tickets?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (json.pagination) {
            setTicketTotalPages(json.pagination.total_pages || 1);
            setTicketTotalItems(json.pagination.total_items || json.data.length);
          }
          if (json.metrics) {
            setTicketMetrics({
              total: Number(json.metrics.total) || 0,
              active: Number(json.metrics.active) || 0,
              resolved: Number(json.metrics.resolved) || 0
            });
          } else if (ticketFilter === 'all' && !debouncedTicketSearch.trim()) {
            const allItems = json.data;
            const act = allItems.filter((t: any) => ['open', 'in_progress', 'waiting_agent', 'waiting_user'].includes(t.status)).length;
            const resCount = allItems.filter((t: any) => ['resolved', 'closed'].includes(t.status)).length;
            setTicketMetrics({
              total: json.pagination?.total_items || allItems.length,
              active: act,
              resolved: resCount
            });
          }

          const mappedTickets: SupportTicket[] = json.data.map((t: any) => {
            const msgs = Array.isArray(t.messages) ? t.messages : [];
            const hasUnreadAgent = msgs.some((m: any) => (m.sender_type === 'agent' || m.sender_type === 'support') && !m.read_at);
            const isViewed = String(selectedTicketId) === String(t.id) || readTicketIdsRef.current.has(t.id) || readTicketIdsRef.current.has(String(t.id));
            const unreadCount = isViewed ? 0 : (t.unread_count !== undefined ? t.unread_count : (hasUnreadAgent ? 1 : 0));

            return {
              id: t.id,
              ticket_number: t.ticket_number,
              store_id: t.store_id,
              store_slug: t.store?.slug || t.store_slug,
              store: t.store,
              subject: t.subject,
              category: t.category,
              priority: t.priority,
              status: t.status,
              created_at: new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              updated_at: new Date(t.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              last_message_at: t.last_message_at ? new Date(t.last_message_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined,
              unread_count: unreadCount,
              has_unread: unreadCount > 0,
              rating: t.rating,
              rating_comment: t.rating_comment,
              rated_at: t.rated_at,
              messages: msgs.map((m: any) => ({
                id: m.id,
                sender: m.sender_type || 'user',
                sender_name: m.sender_type === 'agent' || m.sender_type === 'support' ? 'Catavor Official Support' : (m.sender?.name || currentUser?.name || 'Pengelola Profil Katalog'),
                message: m.message,
                timestamp: new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                read_at: m.read_at,
                attachments: Array.isArray(m.attachments) ? m.attachments : []
              }))
            };
          });

          // Detect new incoming CS messages for chime sound
          if (!isFirstTicketLoadRef.current) {
            let hasNewIncoming = false;
            mappedTickets.forEach(t => {
              const prevCount = prevTicketMessagesRef.current[String(t.id)] || 0;
              const curCount = t.messages.length;
              if (curCount > prevCount && prevCount > 0) {
                const newMsgs = t.messages.slice(prevCount);
                if (newMsgs.some(m => m.sender === 'support' || m.sender === 'agent')) {
                  hasNewIncoming = true;
                }
              }
            });
            if (hasNewIncoming) {
              playSupportChime();
              showToast('Pesan balasan baru dari Tim CS Catavor telah masuk.', 'info');
            }
          }

          const counts: Record<string, number> = {};
          mappedTickets.forEach(t => {
            counts[String(t.id)] = t.messages.length;
          });
          prevTicketMessagesRef.current = counts;
          isFirstTicketLoadRef.current = false;

          setTickets(mappedTickets);

          // Update parent unread count
          const unreadTotal = mappedTickets.filter(t => t.has_unread || (t.unread_count && t.unread_count > 0)).length;
          if (onUpdateUnreadCount) onUpdateUnreadCount(unreadTotal);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tablet support tickets:', err);
    } finally {
      isFetchingTicketsRef.current = false;
      if (!silent) setLoadingTickets(false);
    }
  }, [token, ticketPage, ticketLimit, ticketFilter, debouncedTicketSearch, storeSlug, getAuthHeaders, selectedTicketId, currentUser?.name, playSupportChime, showToast, onUpdateUnreadCount]);

  // 2. Fetch single ticket detail
  const fetchTicketDetails = useCallback(async (ticketId: string | number) => {
    if (!token || !ticketId || ticketId === 'new') return;
    setLoadingTicketDetail(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const t = json.data.ticket || json.data;
          const msgList = Array.isArray(json.data.messages) ? json.data.messages : (Array.isArray(t.messages) ? t.messages : []);

          const mapped: SupportTicket = {
            id: t.id,
            ticket_number: t.ticket_number,
            store_id: t.store_id,
            store_slug: t.store?.slug || t.store_slug,
            store: t.store,
            subject: t.subject,
            category: t.category,
            priority: t.priority,
            status: t.status,
            created_at: new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            updated_at: new Date(t.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            unread_count: 0,
            has_unread: false,
            rating: t.rating,
            rating_comment: t.rating_comment,
            rated_at: t.rated_at,
            messages: msgList.map((m: any) => ({
              id: m.id,
              sender: m.sender_type || 'user',
              sender_name: m.sender_type === 'agent' || m.sender_type === 'support' ? 'Catavor Official Support' : (m.sender?.name || currentUser?.name || 'Pengelola Profil Katalog'),
              message: m.message,
              timestamp: new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              read_at: m.read_at,
              attachments: Array.isArray(m.attachments) ? m.attachments : []
            }))
          };

          setTicketDetails(mapped);
          readTicketIdsRef.current.add(ticketId);
          readTicketIdsRef.current.add(String(ticketId));
          readTicketIdsRef.current.add(t.id);

          // Mark read on backend
          fetch(`/api/support/tickets/${ticketId}/mark-read`, {
            method: 'POST',
            headers: getAuthHeaders()
          }).catch(() => {});

          // Clear unread in list
          setTickets(prev => prev.map(item => String(item.id) === String(ticketId) ? { ...item, unread_count: 0, has_unread: false } : item));
        }
      }
    } catch (err) {
      console.error('Failed to load ticket detail:', err);
    } finally {
      setLoadingTicketDetail(false);
    }
  }, [token, getAuthHeaders, currentUser?.name]);

  // Initial and reactive fetch
  useEffect(() => {
    fetchSupportTickets();
  }, [fetchSupportTickets]);

  // Auto-fetch detail when selection changes
  useEffect(() => {
    if (selectedTicketId && selectedTicketId !== 'new') {
      fetchTicketDetails(selectedTicketId);
    } else if (selectedTicketId === null) {
      setTicketDetails(null);
    }
  }, [selectedTicketId, fetchTicketDetails]);

  // Background polling (every 45s)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (selectedTicketId && selectedTicketId !== 'new') {
        fetchTicketDetails(selectedTicketId);
      }
      fetchSupportTickets(true, ticketPage);
    }, 45000);

    return () => clearInterval(interval);
  }, [token, selectedTicketId, ticketPage, fetchSupportTickets, fetchTicketDetails]);

  // 3. Handle File Upload (Screenshots & PDF)
  const handleUploadAttachment = async (files: FileList | null, isReply: boolean = false) => {
    if (!files || files.length === 0) return;
    const currentList = isReply ? ticketReplyAttachments : ticketNewAttachments;

    if (currentList.length + files.length > 5) {
      showToast('Maksimum 5 file lampiran berkas/screenshot.', 'error');
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const uploaded: TicketAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          showToast(`File ${file.name} melebihi batas 10MB.`, 'error');
          continue;
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', 'support');

        const res = await fetch('/api/storage/upload?category=support', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(storeSlug ? { 'X-Store-Slug': storeSlug } : {})
          },
          body: formData
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const lower = (file.name || '').toLowerCase();
          let detectedType = file.type || '';
          if (!detectedType) {
            if (lower.endsWith('.pdf')) detectedType = 'application/pdf';
            else if (lower.endsWith('.png')) detectedType = 'image/png';
            else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) detectedType = 'image/jpeg';
            else if (lower.endsWith('.webp')) detectedType = 'image/webp';
            else detectedType = 'application/octet-stream';
          }

          uploaded.push({
            file_url: data.url,
            storage_key: data.storage_key || '',
            file_name: file.name,
            file_size: file.size,
            file_type: detectedType
          });
        } else {
          showToast(data.message || `Gagal mengunggah ${file.name}`, 'error');
        }
      }

      if (uploaded.length > 0) {
        if (isReply) {
          setTicketReplyAttachments(prev => [...prev, ...uploaded]);
        } else {
          setTicketNewAttachments(prev => [...prev, ...uploaded]);
        }
        showToast(`${uploaded.length} berkas berhasil dilampirkan.`);
      }
    } catch {
      showToast('Koneksi terputus saat mengunggah lampiran.', 'error');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // 4. Handle Create Ticket
  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = (isSuspendedAccount && !newTicketForm.subject.trim())
      ? `Banding Kepatuhan: Peninjauan Pembekuan Profil Katalog (${settings?.store_title || storeSlug || 'Katalog'})`
      : newTicketForm.subject.trim();

    const finalMessage = (isSuspendedAccount && !newTicketForm.message.trim())
      ? `Halo Tim Kepatuhan & Bantuan Platform Catavor,\n\nSaya selaku pengelola profil katalog mengajukan permohonan peninjauan kembali atas penangguhan/pembekuan pada profil katalog kami:\n- Nama Profil Katalog: ${settings?.store_title || '-'}\n- Status Terdeteksi: ${settings?.dormancy_status || 'suspended'}\n\nKami siap memberikan bukti kepatuhan atau melakukan perbaikan katalog yang diperlukan sesuai panduan komunitas platform.\n\nTerima kasih atas perhatian dan dukungannya.`
      : newTicketForm.message.trim();

    if (!finalSubject || !finalMessage) {
      showToast('Mohon isi Judul dan Detail Pesan Kendala.', 'error');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          store_slug: storeSlug || undefined,
          subject: finalSubject,
          category: isSuspendedAccount ? 'compliance' : newTicketForm.category,
          priority: isSuspendedAccount ? 'high' : newTicketForm.priority,
          message: finalMessage,
          attachments: ticketNewAttachments
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        showToast(isSuspendedAccount ? 'Permohonan banding kepatuhan berhasil dikirim!' : 'Tiket bantuan berhasil diajukan!');
        setNewTicketForm({ subject: '', category: 'technical', priority: 'normal', message: '' });
        setTicketNewAttachments([]);
        setSelectedTicketId(data.data.id);
        fetchSupportTickets();
        fetchTicketDetails(data.data.id);
      } else {
        showToast(data.message || 'Gagal mengajukan tiket bantuan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat mengajukan tiket.', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // 5. Handle Send Reply
  const handleSendReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetails?.id || (!ticketReplyText.trim() && ticketReplyAttachments.length === 0)) return;

    setIsSubmittingReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketDetails.id}/reply`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: ticketReplyText.trim(),
          attachments: ticketReplyAttachments
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTicketReplyText('');
        setTicketReplyAttachments([]);
        showToast('Balasan tiket Anda berhasil dikirim.');
        fetchTicketDetails(ticketDetails.id);
        fetchSupportTickets(true);
      } else {
        showToast(data.message || 'Gagal mengirim balasan tiket.', 'error');
      }
    } catch {
      showToast('Koneksi terputus. Gagal mengirim balasan tiket.', 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // 6. Handle CSAT Rating
  const handleRatingSubmit = async () => {
    if (!ticketDetails?.id) return;
    setIsSubmittingCSAT(true);

    try {
      const res = await fetch(`/api/support/tickets/${ticketDetails.id}/rating`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: csatRating,
          comment: csatComment.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Terima kasih! Ulasan kepuasan Anda berhasil disimpan.');
        setTicketDetails(prev => prev ? { ...prev, rating: csatRating, rating_comment: csatComment.trim(), rated_at: new Date().toISOString() } : null);
        fetchSupportTickets(true);
      } else {
        showToast(data.message || 'Gagal menyimpan ulasan CSAT.', 'error');
      }
    } catch {
      showToast('Koneksi terputus. Gagal menyimpan ulasan.', 'error');
    } finally {
      setIsSubmittingCSAT(false);
    }
  };

  // Handle Download Document
  const handleDownloadAttachment = async (att: TicketAttachment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fileName = att.file_name || 'Dokumen.pdf';
    try {
      const targetUrl = att.id ? `/api/support/attachments/${att.id}?download=1` : att.file_url;
      const res = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        return;
      }
    } catch {}

    const link = document.createElement('a');
    link.href = att.id ? `/api/support/attachments/${att.id}?download=1` : att.file_url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check active appeal if suspended
  const activeAppeal = isSuspendedAccount ? tickets.find(t => {
    if (t.status === 'closed' || t.status === 'resolved') return false;
    return t.category === 'compliance' || (t.subject || '').toLowerCase().includes('banding') || (t.subject || '').toLowerCase().includes('suspend');
  }) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* ===================================================================
          1. TOP TABLET STATS BANNER
          =================================================================== */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--border-light)',
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '0.75rem',
            backgroundColor: isSuspendedAccount ? 'rgba(239, 68, 68, 0.12)' : 'var(--primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSuspendedAccount ? '#ef4444' : 'var(--primary)',
            border: '1px solid var(--border-light)',
            flexShrink: 0
          }}>
            {isSuspendedAccount ? <Scale size={22} /> : <HelpCircle size={22} />}
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {isSuspendedAccount ? 'Pusat Banding Kepatuhan & Tiket' : 'Pusat Bantuan & Tiket CS'}
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isSuspendedAccount ? 'Layanan Klarifikasi dan Pemulihan Akun Profil Katalog' : 'Layanan Bantuan & Monitoring Kendala Pengelolaan Katalog'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Counters Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.4rem 0.85rem',
            backgroundColor: 'var(--bg-deep)',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-light)',
            fontSize: '0.78rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 600, display: 'block' }}>Total Tiket</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{ticketMetrics.total || tickets.length}</strong>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-light)' }} />
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 600, display: 'block' }}>Aktif Diproses</span>
              <strong style={{ color: '#f59e0b', fontSize: '0.92rem' }}>{ticketMetrics.active || tickets.filter(t => ['open', 'in_progress', 'waiting_agent', 'waiting_user'].includes(t.status)).length}</strong>
            </div>
          </div>

          {/* Official WhatsApp CS Support */}
          <button
            type="button"
            onClick={() => window.open('https://wa.me/6281234567890?text=Halo%20Admin%20Catavor', '_blank')}
            style={{
              minHeight: '40px',
              padding: '0.45rem 0.95rem',
              borderRadius: '0.65rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Phone size={15} />
            <span>Chat CS Resmi</span>
          </button>

          {/* Create Ticket Action */}
          {!(isSuspendedAccount && activeAppeal) ? (
            <button
              type="button"
              onClick={() => {
                if (isSuspendedAccount) {
                  setNewTicketForm({
                    subject: `Banding Kepatuhan: Peninjauan Pembekuan Profil Katalog (${settings?.store_title || storeSlug || 'Katalog'})`,
                    category: 'compliance',
                    priority: 'high',
                    message: `Halo Tim Kepatuhan & Bantuan Platform Catavor,\n\nSaya selaku pengelola profil katalog mengajukan permohonan peninjauan kembali atas penangguhan/pembekuan pada profil katalog kami:\n- Nama Profil Katalog: ${settings?.store_title || '-'}\n- Status Terdeteksi: ${settings?.dormancy_status || 'suspended'}\n\nKami siap memberikan bukti kepatuhan atau melakukan perbaikan katalog yang diperlukan sesuai panduan komunitas platform.\n\nTerima kasih atas perhatian dan dukungannya.`
                  });
                }
                setSelectedTicketId('new');
              }}
              style={{
                minHeight: '40px',
                padding: '0.45rem 1rem',
                borderRadius: '0.65rem',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'all 0.15s ease'
              }}
            >
              {isSuspendedAccount ? <Scale size={16} /> : <Plus size={16} />}
              <span>{isSuspendedAccount ? 'Ajukan Banding Baru' : 'Buat Tiket Baru'}</span>
            </button>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '0.65rem',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#f59e0b',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              <Clock size={15} />
              <span>Banding Aktif (#{activeAppeal.ticket_number || activeAppeal.id})</span>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================
          2. MASTER-DETAIL SPLIT VIEW (ADAPTIF ERGONOMI TABLET)
          =================================================================== */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TabletMasterDetailView
          title="Pusat Bantuan & Tiket"
          subtitle={`${tickets.length} riwayat tiket`}
          hideHeaderTitle={true}
          selectedId={selectedTicketId}
          onClearSelection={() => {
            setSelectedTicketId(null);
            setTicketDetails(null);
          }}
          emptyDetailMessage="Pilih salah satu tiket dari daftar untuk melihat percakapan atau klik 'Buat Tiket Baru' di bagian atas."
          masterPane={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0.85rem', gap: '0.65rem' }}>
              
              {/* Search input with clear button */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Cari ID atau judul tiket..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '2.25rem',
                    paddingRight: ticketSearch ? '2rem' : '0.75rem',
                    borderRadius: '0.6rem',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                {ticketSearch && (
                  <button
                    type="button"
                    onClick={() => setTicketSearch('')}
                    style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>


              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '0.55rem', border: '1px solid var(--border-light)' }}>
                {(['all', 'active', 'resolved'] as const).map(tab => {
                  const label = tab === 'all' ? `Semua (${ticketMetrics.total || tickets.length})` : tab === 'active' ? `Aktif (${ticketMetrics.active})` : `Selesai (${ticketMetrics.resolved})`;
                  const isSelected = ticketFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTicketFilter(tab)}
                      style={{
                        flex: 1,
                        minHeight: '32px',
                        padding: '0.25rem 0.4rem',
                        borderRadius: '0.45rem',
                        border: 'none',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Tickets List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem', minHeight: 0 }}>
                {loadingTickets ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <Loader size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                    Memuat daftar tiket...
                  </div>
                ) : tickets.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <MessageSquare size={30} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.82rem', margin: 0 }}>Belum ada tiket bantuan yang diajukan.</p>
                  </div>
                ) : (
                  tickets.map(tk => {
                    const isSelected = String(selectedTicketId) === String(tk.id);
                    const isResolved = ['resolved', 'closed'].includes(tk.status);
                    const isWaitingUser = tk.status === 'waiting_user';
                    const hasUnread = Boolean(tk.has_unread || (tk.unread_count && tk.unread_count > 0));
                    const lastMsg = tk.messages && tk.messages.length > 0 ? tk.messages[tk.messages.length - 1] : null;

                    return (
                      <div
                        key={tk.id}
                        onClick={() => {
                          setSelectedTicketId(tk.id);
                          readTicketIdsRef.current.add(tk.id);
                          readTicketIdsRef.current.add(String(tk.id));
                          setTickets(prev => prev.map(t => String(t.id) === String(tk.id) ? { ...t, unread_count: 0, has_unread: false } : t));
                        }}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '0.75rem',
                          backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.12)' : 'var(--bg-card)',
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                          borderLeft: hasUnread ? '3.5px solid #ef4444' : (isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)'),
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Card Header: ID, Priority, Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-muted)' }}>
                            #{tk.ticket_number || tk.id}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {hasUnread && (
                              <span style={{
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '999px',
                                backgroundColor: '#ef4444',
                                color: '#ffffff'
                              }}>
                                Baru
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.12rem 0.5rem',
                              borderRadius: '999px',
                              backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.12)' : isWaitingUser ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: isResolved ? '#10b981' : isWaitingUser ? '#ef4444' : '#f59e0b'
                            }}>
                              {isResolved ? 'Selesai' : isWaitingUser ? 'Perlu Respon' : 'Dalam Proses'}
                            </span>
                          </div>
                        </div>

                        {/* Subject */}
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {tk.subject}
                        </div>

                        {/* Snippet & Date */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                            {lastMsg ? `${lastMsg.sender_name}: ${lastMsg.message}` : (tk.category || 'Teknis')}
                          </span>
                          <span>{tk.last_message_at || tk.updated_at || tk.created_at}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Master Pagination Controls */}
              {ticketTotalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-light)',
                  fontSize: '0.76rem',
                  flexShrink: 0
                }}>
                  <button
                    type="button"
                    disabled={ticketPage <= 1 || loadingTickets}
                    onClick={() => setTicketPage(prev => Math.max(1, prev - 1))}
                    style={{
                      minHeight: '34px',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      color: ticketPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: ticketPage <= 1 ? 'not-allowed' : 'pointer',
                      fontWeight: 700
                    }}
                  >
                    &larr; Sebelumnya
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    Hal {ticketPage} / {ticketTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={ticketPage >= ticketTotalPages || loadingTickets}
                    onClick={() => setTicketPage(prev => Math.min(ticketTotalPages, prev + 1))}
                    style={{
                      minHeight: '34px',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      backgroundColor: 'var(--bg-card)',
                      color: ticketPage >= ticketTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: ticketPage >= ticketTotalPages ? 'not-allowed' : 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Selanjutnya &rarr;
                  </button>
                </div>
              )}
            </div>
          }
          detailPane={
            selectedTicketId === 'new' ? (
              /* ===================================================================
                 VIEW: CREATE NEW TICKET FORM
                 =================================================================== */
              <div style={{ padding: '1.75rem', maxWidth: '640px', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                    {isSuspendedAccount ? (
                      <>
                        <Scale size={20} color="var(--primary)" />
                        Formulir Banding Kepatuhan
                      </>
                    ) : (
                      <>
                        <Plus size={20} color="var(--primary)" />
                        Ajukan Tiket Bantuan CS
                      </>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketId(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                      SUBJEK KENDALA *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kendala Verifikasi Pembayaran Upgrade Paket"
                      value={isSuspendedAccount ? (newTicketForm.subject || `Banding Kepatuhan: Peninjauan Pembekuan Profil Katalog (${settings?.store_title || storeSlug || 'Katalog'})`) : newTicketForm.subject}
                      readOnly={isSuspendedAccount}
                      onChange={(e) => {
                        if (!isSuspendedAccount) setNewTicketForm({ ...newTicketForm, subject: e.target.value });
                      }}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.6rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: isSuspendedAccount ? 'var(--bg-deep)' : 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                        KATEGORI BANTUAN
                      </label>
                      <select
                        value={isSuspendedAccount ? 'compliance' : newTicketForm.category}
                        disabled={isSuspendedAccount}
                        onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.6rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                          outline: 'none'
                        }}
                      >
                        <option value="technical">Kendala Teknis & Aplikasi</option>
                        <option value="billing">Tagihan & Langganan</option>
                        <option value="account">Akun & Verifikasi</option>
                        <option value="report">Laporan Pelanggaran</option>
                        <option value="compliance">Kepatuhan & Banding</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                        TINGKAT URGENSI
                      </label>
                      <select
                        value={isSuspendedAccount ? 'high' : newTicketForm.priority}
                        disabled={isSuspendedAccount}
                        onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.6rem',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                          outline: 'none'
                        }}
                      >
                        <option value="low">Rendah (Pertanyaan Umum)</option>
                        <option value="normal">Normal (Operasional)</option>
                        <option value="high">Tinggi (Urgensi Bisnis)</option>
                        <option value="urgent">Mendesak (Darurat)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                      RINCIAN KENDALA *
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Jelaskan secara mendetail kronologi atau kendala yang dialami..."
                      value={newTicketForm.message}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, message: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.6rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.86rem',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.5,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Attachment Manager */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
                        LAMPIRAN BUKTI / SCREENSHOT (OPSIONAL)
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {ticketNewAttachments.length}/5 file
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      {ticketNewAttachments.map((att, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'var(--bg-deep)',
                            border: '1px solid var(--border-light)',
                            fontSize: '0.76rem',
                            color: 'var(--text-primary)'
                          }}
                        >
                          <FileText size={14} color="var(--primary)" />
                          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.file_name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTicketNewAttachments(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {ticketNewAttachments.length < 5 && (
                      <div>
                        <input
                          type="file"
                          id="tablet-create-attachment-input"
                          multiple
                          accept="image/png, image/jpeg, image/webp, application/pdf, .pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => handleUploadAttachment(e.target.files, false)}
                        />
                        <button
                          type="button"
                          disabled={isUploadingAttachment}
                          onClick={() => document.getElementById('tablet-create-attachment-input')?.click()}
                          style={{
                            minHeight: '40px',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.55rem',
                            border: '1px dashed var(--border-light)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            cursor: isUploadingAttachment ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isUploadingAttachment ? <Loader size={15} className="animate-spin" /> : <Paperclip size={15} color="var(--primary)" />}
                          <span>Unggah File Lampiran (Foto / PDF)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.5rem',
                        borderRadius: '0.65rem',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: isSubmittingTicket ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSubmittingTicket ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                      <span>{isSubmittingTicket ? 'Mengirim...' : 'Kirimkan Tiket'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(null)}
                      style={{
                        minHeight: '44px',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '0.65rem',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            ) : ticketDetails ? (
              /* ===================================================================
                 VIEW: TICKET DETAIL & INTERACTIVE CHAT THREAD
                 =================================================================== */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                
                {/* Detail Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '0.4rem', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid var(--border-light)' }}>
                        #{ticketDetails.ticket_number || ticketDetails.id}
                      </span>
                      {ticketDetails.store_slug && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Store size={13} /> {ticketDetails.store?.name || ticketDetails.store_slug}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => fetchTicketDetails(ticketDetails.id)}
                        title="Segarkan Percakapan"
                        style={{ minHeight: '34px', padding: '0.35rem 0.65rem', borderRadius: '0.5rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', fontWeight: 600 }}
                      >
                        <RefreshCw size={13} className={loadingTicketDetail ? 'animate-spin' : ''} />
                        <span>Segarkan</span>
                      </button>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        backgroundColor: ['resolved', 'closed'].includes(ticketDetails.status) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: ['resolved', 'closed'].includes(ticketDetails.status) ? '#10b981' : '#f59e0b'
                      }}>
                        {['resolved', 'closed'].includes(ticketDetails.status) ? '✓ Selesai' : '● Dalam Proses'}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                    {ticketDetails.subject}
                  </h3>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.76rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>Kategori: <strong>{ticketDetails.category || 'Teknis'}</strong></span>
                    <span>Prioritas: <strong>{ticketDetails.priority || 'Normal'}</strong></span>
                    <span>Dibuat: {ticketDetails.created_at}</span>
                  </div>
                </div>

                {/* Messages Scroll Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {ticketDetails.messages.map((msg, index) => {
                    const isStaff = msg.sender === 'support' || msg.sender === 'agent' || msg.sender === 'system';
                    const attList = msg.attachments || [];

                    return (
                      <div
                        key={msg.id || index}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStaff ? 'flex-start' : 'flex-end',
                          gap: '0.3rem'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isStaff ? (
                            <>
                              <ShieldCheck size={14} color="var(--primary)" />
                              <strong>{msg.sender_name || 'Tim CS Catavor'}</strong>
                            </>
                          ) : (
                            <strong>{msg.sender_name || 'Anda (Pengelola)'}</strong>
                          )}
                          <span>&bull;</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div style={{
                          maxWidth: '82%',
                          padding: '0.85rem 1.15rem',
                          borderRadius: '0.85rem',
                          backgroundColor: isStaff ? 'var(--bg-deep)' : 'var(--primary-glow)',
                          border: isStaff ? '1px solid var(--border-light)' : '1px solid var(--primary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {msg.message}

                          {/* Attachments rendering */}
                          {attList.length > 0 && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem' }}>
                              {attList.map((att, aIdx) => {
                                const isPdf = (att.file_type || '').includes('pdf') || (att.file_name || '').toLowerCase().endsWith('.pdf');
                                const src = supportAttachmentSrc(att);

                                if (isPdf) {
                                  return (
                                    <div
                                      key={aIdx}
                                      onClick={() => {
                                        setDocPreview({
                                          isOpen: true,
                                          id: att.id,
                                          url: src,
                                          fileName: att.file_name || 'Dokumen.pdf',
                                          fileSize: att.file_size,
                                          fileType: 'application/pdf'
                                        });
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.45rem',
                                        padding: '0.45rem 0.75rem',
                                        borderRadius: '0.5rem',
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border-light)',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <FileText size={16} color="#ef4444" />
                                      <span style={{ fontSize: '0.76rem', fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.file_name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleDownloadAttachment(att, e)}
                                        title="Unduh Berkas"
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.15rem' }}
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={aIdx}
                                    onClick={() => setActiveImageLightbox(src)}
                                    style={{
                                      width: '64px',
                                      height: '64px',
                                      borderRadius: '0.5rem',
                                      overflow: 'hidden',
                                      border: '1px solid var(--border-light)',
                                      cursor: 'pointer',
                                      position: 'relative'
                                    }}
                                  >
                                    <img
                                      src={src}
                                      alt={att.file_name}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* CSAT 1-Click Rating (When Ticket Resolved) */}
                {['resolved', 'closed'].includes(ticketDetails.status) && (
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-deep)', flexShrink: 0 }}>
                    {ticketDetails.rating ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Star size={18} fill="#f59e0b" color="#f59e0b" />
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#f59e0b' }}>
                            Ulasan Kepuasan Anda: {ticketDetails.rating}/5 Bintang
                          </span>
                        </div>
                        {ticketDetails.rating_comment && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            "{ticketDetails.rating_comment}"
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Bagaimana kepuasan Anda terhadap penanganan tiket ini?
                          </span>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setCsatRating(star)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                              >
                                <Star
                                  size={20}
                                  fill={star <= csatRating ? '#f59e0b' : 'none'}
                                  color={star <= csatRating ? '#f59e0b' : 'var(--text-muted)'}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                          <input
                            type="text"
                            placeholder="Tulis ulasan atau masukan singkat (opsional)..."
                            value={csatComment}
                            onChange={(e) => setCsatComment(e.target.value)}
                            style={{
                              flex: 1,
                              minHeight: '38px',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="button"
                            disabled={isSubmittingCSAT}
                            onClick={handleRatingSubmit}
                            style={{
                              minHeight: '38px',
                              padding: '0 1rem',
                              borderRadius: '0.5rem',
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: isSubmittingCSAT ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isSubmittingCSAT ? 'Menyimpan...' : 'Kirim Ulasan'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reply Bar Footer */}
                {!['resolved', 'closed'].includes(ticketDetails.status) ? (
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
                    
                    {/* Attachment Chips before sending */}
                    {ticketReplyAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.5rem' }}>
                        {ticketReplyAttachments.map((att, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.3rem 0.6rem',
                              borderRadius: '0.45rem',
                              backgroundColor: 'var(--bg-deep)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.74rem'
                            }}
                          >
                            <FileText size={13} color="var(--primary)" />
                            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.file_name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTicketReplyAttachments(prev => prev.filter((_, idx) => idx !== i))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleSendReplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <textarea
                        rows={2}
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Tuliskan tanggapan balasan atau penjelasan tambahan..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '0.6rem',
                          backgroundColor: 'var(--bg-deep)',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                          outline: 'none',
                          resize: 'none',
                          lineHeight: 1.45,
                          boxSizing: 'border-box'
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <input
                            type="file"
                            id="tablet-reply-attachment-input"
                            multiple
                            accept="image/png, image/jpeg, image/webp, application/pdf, .pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => handleUploadAttachment(e.target.files, true)}
                          />
                          <button
                            type="button"
                            disabled={isUploadingAttachment || ticketReplyAttachments.length >= 5}
                            onClick={() => document.getElementById('tablet-reply-attachment-input')?.click()}
                            style={{
                              minHeight: '38px',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '0.55rem',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'var(--bg-deep)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: isUploadingAttachment || ticketReplyAttachments.length >= 5 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isUploadingAttachment ? <Loader size={14} className="animate-spin" /> : <Paperclip size={14} color="var(--primary)" />}
                            <span>Lampirkan Berkas (Maks. 5)</span>
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingReply || (!ticketReplyText.trim() && ticketReplyAttachments.length === 0)}
                          style={{
                            minHeight: '40px',
                            padding: '0 1.25rem',
                            borderRadius: '0.55rem',
                            backgroundColor: 'var(--primary)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            cursor: isSubmittingReply || (!ticketReplyText.trim() && ticketReplyAttachments.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (!ticketReplyText.trim() && ticketReplyAttachments.length === 0) ? 0.6 : 1
                          }}
                        >
                          {isSubmittingReply ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                          <span>Kirim Balasan</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div style={{ padding: '0.9rem 1.5rem', textAlign: 'center', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderTop: '1px solid rgba(16, 185, 129, 0.25)', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                      ✓ Tiket ini telah ditandai Selesai. Silakan ajukan tiket baru jika memiliki kendala lain.
                    </span>
                  </div>
                )}
              </div>
            ) : null
          }
        />
      </div>

      {/* ===================================================================
          3. ATTACHMENT LIGHTBOX & DOCUMENT PREVIEW MODALS
          =================================================================== */}
      {docPreview && docPreview.isOpen && (
        <DocumentPreviewModal
          data={docPreview}
          onClose={() => setDocPreview(null)}
          token={token}
        />
      )}

      {activeImageLightbox && (
        <div
          onClick={() => setActiveImageLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={activeImageLightbox}
              alt="Lampiran Tiket"
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '0.75rem', objectFit: 'contain' }}
            />
            <button
              type="button"
              onClick={() => setActiveImageLightbox(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
