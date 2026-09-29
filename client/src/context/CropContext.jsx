import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ImageCropperModal } from '../components/ImageCropperModal.jsx';

const CropContext = createContext(null);

// Exposes cropFile(file, { ratio }) => Promise<File|null>. Resolves with the
// cropped File when the user applies, or null when they cancel/close.
export function CropProvider({ children }) {
  const [state, setState] = useState(null);

  const cropFile = useCallback((file, { ratio = null } = {}) => {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve) => setState({ file, initialRatio: ratio, resolve }));
  }, []);

  const finish = useCallback((result) => {
    setState((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ cropFile }), [cropFile]);

  return (
    <CropContext.Provider value={value}>
      {children}
      <ImageCropperModal
        open={Boolean(state)}
        file={state?.file ?? null}
        initialRatio={state?.initialRatio ?? null}
        onApply={(file) => finish(file)}
        onCancel={() => finish(null)}
      />
    </CropContext.Provider>
  );
}

export function useCrop() {
  const ctx = useContext(CropContext);
  if (!ctx) throw new Error('useCrop must be used within a CropProvider');
  return ctx;
}
