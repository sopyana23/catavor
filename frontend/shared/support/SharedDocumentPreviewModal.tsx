import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Download,
  X,
  ShieldCheck,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ScrollText,
} from 'lucide-react';

export interface PdfDocumentProxyLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  cleanup?: () => void;
}

export interface PdfjsLibLike {
  getDocument: (src: any) => {
    promise: Promise<PdfDocumentProxyLike>;
    destroy?: () => Promise<void> | void;
  };
}

const isSameOriginUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('\\') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false;
  }
  try {
    const baseOrigin = window.location.origin;
    if (!baseOrigin || baseOrigin === 'null') return false;
    const parsed = new URL(trimmed, baseOrigin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === baseOrigin
    );
  } catch {
    return false;
  }
};

export interface DocumentPreviewData {
  isOpen: boolean;
  id?: number | string;
  url?: string;
  fileUrl?: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  blobUrl?: string;
}

export interface SharedDocumentPreviewModalProps {
  document?: DocumentPreviewData | null;
  data?: DocumentPreviewData | null;
  onClose: () => void;
  token?: string;
  formFactor: 'desktop' | 'tablet' | 'mobile';
  pdfjsLib: PdfjsLibLike;
  useModalBackHandlerHook?: (opts: { isOpen: boolean; onClose: () => void; modalId: string }) => void;
}

interface PdfPageProps {
  pdfDoc: PdfDocumentProxyLike;
  pageNum: number;
  scale: number;
}

const PdfPageCanvas: React.FC<PdfPageProps> = ({ pdfDoc, pageNum, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      try {
        setPageLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const renderTask = page.render({
          canvas: canvasRef.current,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!isCancelled) {
          setPageLoading(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !isCancelled) {
          console.warn(`PDF page ${pageNum} render error:`, err);
          setPageLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '3px 9px',
          borderRadius: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: '#cbd5e1',
          fontSize: '0.66rem',
          fontWeight: 700,
          pointerEvents: 'none',
          zIndex: 5,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        <span>Hal {pageNum}</span>
        {pageLoading && <RefreshCw size={10} className="animate-spin" color="#38bdf8" />}
      </div>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', width: '100%', height: 'auto' }} />
    </div>
  );
};

interface PdfPageSlotProps {
  pdfDoc: PdfDocumentProxyLike;
  pageNum: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onPageActive?: (pageNum: number) => void;
}

const PdfPageSlot: React.FC<PdfPageSlotProps> = ({
  pdfDoc,
  pageNum,
  scale,
  baseWidth,
  baseHeight,
  scrollContainerRef,
  onPageActive,
}) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(pageNum === 1);

  useEffect(() => {
    const node = slotRef.current;
    const container = scrollContainerRef.current;
    if (!node || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4 && onPageActive) {
            onPageActive(pageNum);
          }
        });
      },
      {
        root: container,
        rootMargin: '350px 0px',
        threshold: [0, 0.4],
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [scrollContainerRef, pageNum, onPageActive]);

  const computedWidth = Math.floor(baseWidth * scale);
  const computedHeight = Math.floor(baseHeight * scale);

  return (
    <div
      ref={slotRef}
      id={`pdf-page-slot-${pageNum}`}
      style={{
        position: 'relative',
        marginBottom: '1.25rem',
        borderRadius: '6px',
        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        backgroundColor: isVisible ? '#ffffff' : '#1e293b',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isVisible ? 'flex-start' : 'center',
        width: `${computedWidth}px`,
        height: isVisible ? 'auto' : `${computedHeight}px`,
        minHeight: `${computedHeight}px`,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {isVisible ? (
        <PdfPageCanvas pdfDoc={pdfDoc} pageNum={pageNum} scale={scale} />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            color: '#64748b',
            height: '100%',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Halaman {pageNum}</span>
          <span style={{ fontSize: '0.7rem', color: '#475569' }}>Gulir untuk merender</span>
        </div>
      )}
    </div>
  );
};

export const SharedDocumentPreviewModal: React.FC<SharedDocumentPreviewModalProps> = React.memo(({
  document: docProp,
  data,
  onClose,
  token,
  formFactor,
  pdfjsLib,
  useModalBackHandlerHook,
}) => {
  const doc = docProp || data;
  const isTouch = formFactor === 'mobile' || formFactor === 'tablet';
  const isMobile = formFactor === 'mobile';
  const isDesktop = formFactor === 'desktop';

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxyLike | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpInput, setJumpInput] = useState<string>('1');
  const [scale, setScale] = useState<number>(1.0);
  const [fitScale, setFitScale] = useState<number>(1.0);
  const [baseWidth, setBaseWidth] = useState<number>(595);
  const [baseHeight, setBaseHeight] = useState<number>(842);
  const [viewMode, setViewMode] = useState<'continuous' | 'single'>('continuous');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const pdfTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [pdfDragOffset, setPdfDragOffset] = useState<number>(0);
  const [isPdfSwiping, setIsPdfSwiping] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Keep token in a ref so auth token refreshes never trigger blob URL revocation
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const isOpen = Boolean(doc?.isOpen);

  useModalBackHandlerHook?.({
    isOpen,
    onClose,
    modalId: `${formFactor}-document-preview`,
  });

  const docId = doc?.id;
  const fileUrl = doc?.fileUrl || doc?.url;
  const fileName = doc?.fileName;
  const localBlob = doc?.blobUrl || (doc as any)?.blob_url;

  const isPDF = Boolean(
    doc?.fileType === 'application/pdf' ||
      fileName?.toLowerCase().endsWith('.pdf') ||
      fileUrl?.toLowerCase().endsWith('.pdf')
  );

  const isImage = Boolean(
    doc?.fileType?.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName || '') ||
      /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileUrl || '')
  );

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const documentKey = isOpen ? `${docId ?? ''}::${fileUrl ?? ''}::${fileName ?? ''}::${localBlob ?? ''}` : null;
  const prevDocKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentKey) {
      if (prevDocKeyRef.current !== null) {
        setPdfDoc((prev: PdfDocumentProxyLike | null) => {
          if (prev) {
            try {
              prev.cleanup?.();
            } catch {}
          }
          return null;
        });
        setNumPages(0);
        setCurrentPage(1);
        setJumpInput('1');
        setImageSrc(null);
        setBlobUrl((prev) => {
          if (prev && prev.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
          }
          return '';
        });
        setError(null);
        prevDocKeyRef.current = null;
      }
      return;
    }

    if (prevDocKeyRef.current === documentKey) {
      return;
    }
    prevDocKeyRef.current = documentKey;

    let active = true;
    let createdBlobUrl = '';

    const loadDocumentData = async () => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      setJumpInput('1');

      const authToken = tokenRef.current || localStorage.getItem('catavor_token') || '';
      let res: Response | null = null;
      let targetUrl = '';

      if (localBlob) {
        targetUrl = localBlob;
        try {
          res = await fetch(targetUrl);
        } catch (e) {
          console.warn(`${formFactor} preview: failed to fetch local blob:`, e);
        }
      }

      if ((!res || !res.ok) && docId) {
        targetUrl = `/api/support/attachments/${docId}`;
        try {
          const canSendAuth = !!(authToken && isSameOriginUrl(targetUrl));
          res = await fetch(targetUrl, {
            headers: canSendAuth ? { Authorization: `Bearer ${authToken}` } : {},
            credentials: isSameOriginUrl(targetUrl) ? 'include' : 'omit',
          });
        } catch (e) {
          console.warn(`${formFactor} preview: failed to fetch by docId ${docId}:`, e);
        }
      }

      if ((!res || !res.ok) && fileUrl && fileUrl !== targetUrl) {
        targetUrl = fileUrl;
        try {
          const canSendAuth = !!(
            authToken &&
            isSameOriginUrl(targetUrl) &&
            !targetUrl.startsWith('data:') &&
            !targetUrl.startsWith('blob:')
          );
          res = await fetch(targetUrl, {
            headers: canSendAuth ? { Authorization: `Bearer ${authToken}` } : {},
            credentials: isSameOriginUrl(targetUrl) ? 'include' : 'omit',
          });
        } catch (e) {
          console.warn(`${formFactor} preview: failed to fetch by fileUrl:`, e);
        }
      }

      try {
        if (!res || !res.ok) {
          let errorDetail = res ? `${res.status} ${res.statusText}` : 'Koneksi ke berkas lampiran gagal';
          if (res) {
            try {
              const errData = await res.json();
              if (errData && errData.message) {
                errorDetail = errData.message;
              }
            } catch {}
          }
          throw new Error(`Gagal memuat dokumen (${errorDetail})`);
        }

        const blob = await res.blob();
        if (!active) return;

        createdBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(createdBlobUrl);

        const detectedIsImage = isImage || (blob.type && blob.type.startsWith('image/'));
        const detectedIsPdf = isPDF || blob.type === 'application/pdf';

        if (detectedIsImage && !detectedIsPdf) {
          setImageSrc(createdBlobUrl);
          setLoading(false);
          return;
        }

        if (detectedIsPdf || !detectedIsImage) {
          const arrayBuffer = await blob.arrayBuffer();
          if (!active) return;

          const assetBase = `${import.meta.env.BASE_URL}pdfjs/`;
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: `${assetBase}cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${assetBase}standard_fonts/`,
            enableXfa: false,
            maxImageSize: 16777216,
          });

          const loadedPdf = await loadingTask.promise;
          if (!active) {
            try {
              await loadingTask.destroy?.();
            } catch {}
            return;
          }

          setPdfDoc(loadedPdf);
          setNumPages(loadedPdf.numPages);

          try {
            const firstPage = await loadedPdf.getPage(1);
            const defaultViewport = firstPage.getViewport({ scale: 1.0 });
            setBaseWidth(defaultViewport.width);
            setBaseHeight(defaultViewport.height);

            const containerW =
              formFactor === 'desktop'
                ? window.innerWidth > 900
                  ? 860
                  : window.innerWidth - 60
                : formFactor === 'tablet'
                  ? Math.min(window.innerWidth - 64, 780)
                  : Math.min(window.innerWidth - 24, 600);
            const paddingAllowance = formFactor === 'desktop' ? 48 : 32;
            const initialScale = Math.max(0.45, Math.min(2.0, (containerW - paddingAllowance) / defaultViewport.width));
            setFitScale(initialScale);
            setScale(initialScale);
          } catch {
            setScale(1.0);
            setFitScale(1.0);
          }

          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        console.warn(`${formFactor} document preview load failed:`, err);
        setError(err.message || 'Gagal memuat pratinjau dokumen.');
        setLoading(false);
      }
    };

    loadDocumentData();

    return () => {
      active = false;
      if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [isOpen, documentKey, docId, fileUrl, fileName, localBlob, isPDF, isImage, formFactor]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(3.0, +(prev + 0.15).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(fitScale);
  }, [fitScale]);

  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || baseWidth <= 0) return;
    const containerW = containerRef.current.clientWidth - (isDesktop ? 48 : 28);
    const targetScale = Math.max(0.4, Math.min(3.0, +(containerW / baseWidth).toFixed(2)));
    setScale(targetScale);
  }, [baseWidth, isDesktop]);

  const handlePageActive = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
    setJumpInput(String(pageNum));
  }, []);

  const scrollToPage = useCallback((targetPage: number) => {
    const pageEl = window.document.getElementById(`pdf-page-slot-${targetPage}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    const prev = currentPage - 1;
    setCurrentPage(prev);
    setJumpInput(String(prev));
    if (viewMode === 'continuous') {
      scrollToPage(prev);
    }
  }, [currentPage, viewMode, scrollToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage >= numPages) return;
    const next = currentPage + 1;
    setCurrentPage(next);
    setJumpInput(String(next));
    if (viewMode === 'continuous') {
      scrollToPage(next);
    }
  }, [currentPage, numPages, viewMode, scrollToPage]);

  const handleJumpSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const parsed = parseInt(jumpInput, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > numPages) {
        setJumpInput(String(currentPage));
        return;
      }
      setCurrentPage(parsed);
      if (viewMode === 'continuous') {
        scrollToPage(parsed);
      }
    },
    [jumpInput, numPages, currentPage, viewMode, scrollToPage]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') onCloseRef.current();
        return;
      }

      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrevPage, handleNextPage, handleZoomIn, handleZoomOut]);

  const handleDownload = async () => {
    const authToken = tokenRef.current || localStorage.getItem('catavor_token') || '';
    const safeFileName = fileName || 'Dokumen.pdf';

    try {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        const link = window.document.createElement('a');
        link.href = blobUrl;
        link.download = safeFileName;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        return;
      }

      const targetUrl = docId ? `/api/support/attachments/${docId}?download=1` : fileUrl || '';
      const canSendAuth = !!(
        authToken &&
        isSameOriginUrl(targetUrl) &&
        !targetUrl.startsWith('data:') &&
        !targetUrl.startsWith('blob:')
      );
      const res = await fetch(targetUrl, {
        headers: canSendAuth ? { Authorization: `Bearer ${authToken}` } : {},
        credentials: isSameOriginUrl(targetUrl) ? 'include' : 'omit',
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = safeFileName;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn(`${formFactor} direct blob download error:`, e);
    }

    const link = window.document.createElement('a');
    link.href = docId ? `/api/support/attachments/${docId}?download=1` : fileUrl || '';
    link.download = safeFileName;
    link.target = '_blank';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const formattedSize = doc?.fileSize
    ? doc.fileSize >= 1024 * 1024
      ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(doc.fileSize / 1024).toFixed(0)} KB`
    : '';

  const zoomPercent = fitScale > 0 ? Math.round((scale / fitScale) * 100) : 100;
  const controlBtnSize = isTouch ? '44px' : '32px';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        backgroundColor: 'rgba(5, 8, 15, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile || isMaximized ? '0' : '1.5rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={() => onCloseRef.current()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: isMobile || isMaximized ? '100vw' : formFactor === 'tablet' ? 'min(860px, 94vw)' : 'min(1120px, 95vw)',
          height: isMobile || isMaximized ? '100vh' : 'min(93vh, 920px)',
          borderRadius: isMobile || isMaximized ? '0' : '1rem',
          backgroundColor: '#0b1120',
          border: isMobile || isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: isMobile ? '0.65rem 0.9rem' : '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            gap: '0.75rem',
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.45rem',
                backgroundColor: isPDF ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                border: `1px solid ${isPDF ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={18} color={isPDF ? '#ef4444' : '#38bdf8'} />
            </div>

            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: isMobile ? '0.82rem' : '0.88rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}
              >
                {fileName || 'Dokumen'}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.68rem',
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '0.15rem',
                }}
              >
                <span style={{ fontWeight: 600, color: isPDF ? '#f87171' : '#38bdf8' }}>
                  {isPDF ? 'PDF' : isImage ? 'Gambar' : 'Berkas'}
                </span>
                {formattedSize && (
                  <>
                    <span style={{ opacity: 0.35 }}>•</span>
                    <span>{formattedSize}</span>
                  </>
                )}
                {numPages > 0 && (
                  <>
                    <span style={{ opacity: 0.35 }}>•</span>
                    <span>{numPages} Hal</span>
                  </>
                )}
                <span style={{ opacity: 0.35 }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#34d399', fontWeight: 600 }}>
                  <ShieldCheck size={11} /> Aman
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            {isPDF && numPages > 1 && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'continuous' ? 'single' : 'continuous')}
                style={{
                  minWidth: controlBtnSize,
                  minHeight: controlBtnSize,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: isMobile ? '0 0.65rem' : '0.4rem 0.75rem',
                  borderRadius: '0.45rem',
                  backgroundColor: viewMode === 'single' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                  border: `1px solid ${viewMode === 'single' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
                  color: viewMode === 'single' ? '#38bdf8' : '#cbd5e1',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title={viewMode === 'continuous' ? 'Beralih ke mode halaman tunggal' : 'Beralih ke mode scroll kontinu'}
              >
                {viewMode === 'continuous' ? <BookOpen size={14} /> : <ScrollText size={14} />}
                {isDesktop && <span>{viewMode === 'continuous' ? 'Halaman Tunggal' : 'Scroll Kontinu'}</span>}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              style={{
                minHeight: controlBtnSize,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: isMobile ? '0 0.85rem' : '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              }}
              title="Unduh Berkas ke Perangkat"
            >
              <Download size={14} />
              <span>Unduh</span>
            </button>

            {isDesktop && (
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.45rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={isMaximized ? 'Kecilkan Jendela' : 'Perbesar Jendela'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}

            {/* Header close button prohibited on mobile per AGENTS.md; desktop & tablet keep it */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                style={{
                  width: controlBtnSize,
                  height: controlBtnSize,
                  borderRadius: '0.45rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Tutup (Esc)"
                aria-label="Tutup pratinjau dokumen"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Main Viewport */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: loading ? 'center' : 'flex-start',
            padding: isMobile ? '1rem 0.65rem 1.25rem' : '1.5rem 1.25rem 2rem',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            backgroundColor: '#090d16',
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <RefreshCw size={36} className="animate-spin" color="#38bdf8" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Menyiapkan pratinjau dokumen...</span>
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Merender halaman secara hemat memori</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', color: '#f87171', padding: '2.5rem 1.25rem', maxWidth: '400px' }}>
              <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ fontSize: '0.88rem', marginBottom: '1.35rem', lineHeight: 1.5 }}>{error}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    minHeight: '44px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '0.55rem',
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                  }}
                >
                  <Download size={16} /> Unduh Berkas Langsung
                </button>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => onCloseRef.current()}
                    style={{
                      minHeight: '44px',
                      padding: '0.6rem 1.2rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255,255,255,0.16)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                    }}
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          ) : isImage && imageSrc ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                minHeight: '60vh',
                padding: '0.75rem',
                boxSizing: 'border-box',
                overflow: 'auto',
              }}
            >
              <img
                src={imageSrc}
                alt={fileName || 'Gambar Lampiran'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '78vh',
                  objectFit: 'contain',
                  borderRadius: '0.65rem',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                  cursor: scale > 1 ? 'zoom-out' : 'zoom-in',
                  userSelect: 'none',
                }}
                onClick={() => setScale((prev) => (prev > 1.2 ? 1.0 : 2.0))}
              />
            </div>
          ) : isPDF && pdfDoc ? (
            viewMode === 'single' ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  touchAction: isTouch && numPages > 1 && scale <= 1.2 ? 'pan-y' : 'auto',
                }}
                onTouchStart={(e) => {
                  if (isTouch && isPDF && numPages > 1 && scale <= 1.2 && e.touches.length === 1) {
                    const touch = e.touches[0];
                    pdfTouchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                    setIsPdfSwiping(true);
                    setPdfDragOffset(0);
                  }
                }}
                onTouchMove={(e) => {
                  if (!isPdfSwiping || !pdfTouchStartRef.current || e.touches.length !== 1) return;
                  const touch = e.touches[0];
                  const dx = touch.clientX - pdfTouchStartRef.current.x;
                  const dy = touch.clientY - pdfTouchStartRef.current.y;
                  if (Math.abs(dx) > Math.abs(dy)) {
                    setPdfDragOffset(dx * 0.42);
                  }
                }}
                onTouchEnd={(e) => {
                  setIsPdfSwiping(false);
                  setPdfDragOffset(0);
                  if (pdfTouchStartRef.current && isPDF && numPages > 1) {
                    const touch = e.changedTouches[0];
                    const dx = touch.clientX - pdfTouchStartRef.current.x;
                    const dy = touch.clientY - pdfTouchStartRef.current.y;
                    const dt = Date.now() - pdfTouchStartRef.current.time;
                    if (Math.abs(dx) >= 35 && Math.abs(dx) > Math.abs(dy) * 1.1 && dt < 600) {
                      if (dx < 0 && currentPage < numPages) {
                        handleNextPage();
                      } else if (dx > 0 && currentPage > 1) {
                        handlePrevPage();
                      }
                    }
                  }
                  pdfTouchStartRef.current = null;
                }}
                onTouchCancel={() => {
                  setIsPdfSwiping(false);
                  setPdfDragOffset(0);
                  pdfTouchStartRef.current = null;
                }}
              >
                <div
                  key={currentPage}
                  style={{
                    position: 'relative',
                    marginBottom: '1.25rem',
                    borderRadius: '6px',
                    boxShadow: '0 10px 32px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    transform: pdfDragOffset !== 0 ? `translateX(${pdfDragOffset}px)` : 'none',
                    transition: isPdfSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <PdfPageCanvas pdfDoc={pdfDoc} pageNum={currentPage} scale={scale} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <PdfPageSlot
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    scale={scale}
                    baseWidth={baseWidth}
                    baseHeight={baseHeight}
                    scrollContainerRef={containerRef}
                    onPageActive={handlePageActive}
                  />
                ))}
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 1rem' }}>
              <FileText size={52} color="#0284c7" style={{ margin: '0 auto 1rem auto' }} />
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1rem' }}>Pratinjau Tidak Didukung</h4>
              <p style={{ margin: '0 0 1.4rem 0', fontSize: '0.82rem', color: '#94a3b8', maxWidth: '320px' }}>
                Format berkas ini dapat dibuka setelah diunduh ke perangkat Anda.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    minHeight: '44px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.55rem',
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                  }}
                >
                  <Download size={16} /> Unduh Berkas Sekarang
                </button>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => onCloseRef.current()}
                    style={{
                      minHeight: '44px',
                      padding: '0.6rem 1.2rem',
                      borderRadius: '0.55rem',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255,255,255,0.16)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                    }}
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Dock */}
        {((isPDF && pdfDoc) || (isImage && imageSrc)) && !loading && !error && (
          <div
            style={{
              padding: isMobile ? '0.5rem 0.75rem' : '0.6rem 1.25rem',
              background: '#0f172a',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              zIndex: 15,
              flexShrink: 0,
              boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.35)',
            }}
          >
            {isPDF && numPages > 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  style={{
                    width: isTouch ? '44px' : '30px',
                    height: isTouch ? '44px' : '30px',
                    borderRadius: '0.35rem',
                    backgroundColor: currentPage <= 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: currentPage <= 1 ? '#475569' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage <= 1 ? 'default' : 'pointer',
                  }}
                  title="Halaman Sebelumnya (Panah Kiri)"
                >
                  <ChevronLeft size={16} />
                </button>

                <form onSubmit={handleJumpSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    onBlur={handleJumpSubmit}
                    style={{
                      width: '34px',
                      height: isTouch ? '36px' : '26px',
                      borderRadius: '0.35rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                    }}
                    title="Ketik nomor halaman dan tekan Enter"
                  />
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>/ {numPages}</span>
                </form>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  style={{
                    width: isTouch ? '44px' : '30px',
                    height: isTouch ? '44px' : '30px',
                    borderRadius: '0.35rem',
                    backgroundColor: currentPage >= numPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: currentPage >= numPages ? '#475569' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage >= numPages ? 'default' : 'pointer',
                  }}
                  title="Halaman Berikutnya (Panah Kanan)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.74rem', fontWeight: 600 }}>
                <span>{isImage ? 'Format: Gambar' : 'Dokumen PDF'}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.4}
                style={{
                  width: isTouch ? '44px' : '30px',
                  height: isTouch ? '44px' : '30px',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: scale <= 0.4 ? '#475569' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: scale <= 0.4 ? 'default' : 'pointer',
                }}
                title="Perkecil (-)"
              >
                <ZoomOut size={15} />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                style={{
                  minHeight: isTouch ? '44px' : '30px',
                  padding: '0 0.55rem',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Reset Zoom Normal"
              >
                {zoomPercent}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                style={{
                  width: isTouch ? '44px' : '30px',
                  height: isTouch ? '44px' : '30px',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: scale >= 3.0 ? '#475569' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: scale >= 3.0 ? 'default' : 'pointer',
                }}
                title="Perbesar (+)"
              >
                <ZoomIn size={15} />
              </button>

              <button
                type="button"
                onClick={handleFitWidth}
                style={{
                  minHeight: isTouch ? '44px' : '30px',
                  padding: '0 0.6rem',
                  borderRadius: '0.35rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Paskan Lebar Layar"
              >
                Fit
              </button>

              {isMobile && (
                <button
                  type="button"
                  onClick={() => onCloseRef.current()}
                  style={{
                    minHeight: '44px',
                    padding: '0 0.85rem',
                    borderRadius: '0.35rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    color: '#f8fafc',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

SharedDocumentPreviewModal.displayName = 'SharedDocumentPreviewModal';
