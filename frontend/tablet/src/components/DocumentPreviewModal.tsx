import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  SharedDocumentPreviewModal,
  type DocumentPreviewData,
} from '../../../shared/support/SharedDocumentPreviewModal';
import { useModalBackHandler } from '../utils/navigation';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type { DocumentPreviewData };

interface DocumentPreviewModalProps {
  document?: DocumentPreviewData | null;
  data?: DocumentPreviewData | null;
  onClose: () => void;
  token?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = React.memo((props) => (
  <SharedDocumentPreviewModal
    {...props}
    formFactor="tablet"
    pdfjsLib={pdfjsLib}
    useModalBackHandlerHook={useModalBackHandler}
  />
));

DocumentPreviewModal.displayName = 'DocumentPreviewModal';
