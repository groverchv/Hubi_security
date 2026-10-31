import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Image as ImageIcon, 
  Music, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  Trash2,
  ArrowRight,
  Video,
  Link as LinkIcon,
  FileCheck
} from 'lucide-react';

export default function ResourceModal({ isOpen, onClose, onProcessMaterials }) {
  const [files, setFiles] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlError, setUrlError] = useState('');
  
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Manejo de carga de archivos (PDFs, docs, imágenes, audios)
  const handleFileChange = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (fileList) => {
    const newFiles = fileList.map((file) => {
      const type = file.type.includes('pdf') ? 'document' :
                   file.type.includes('image') ? 'image' :
                   file.type.includes('audio') ? 'audio' : 'document';
      return {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type,
        rawFile: file
      };
    });
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Agregar Link de YouTube
  const handleAddYoutube = (e) => {
    e.preventDefault();
    setUrlError('');
    const trimmed = youtubeUrl.trim();
    if (!trimmed) return;

    // Validación básica de link de youtube
    if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
      setUrlError('Ingresa un enlace válido de YouTube (ej. https://youtube.com/watch?v=...)');
      return;
    }

    setFiles((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: trimmed,
        size: 'Transmisión Streaming',
        type: 'youtube',
        rawUrl: trimmed
      }
    ]);
    setYoutubeUrl('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleStartGame = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      if (onProcessMaterials) {
        onProcessMaterials({
          files,
          rawFiles: files.map(f => f.rawFile).filter(Boolean),
          text: files.map(f => f.name).join(' ') || 'Material didáctico integrado con éxito.'
        });
      }
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-2xl rounded-arcade-lg bg-[#0f172a] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[92vh]"
        >
          {/* Cabecera limpia y moderna */}
          <div className="p-5 sm:p-6 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-arcade bg-emerald-950 border border-emerald-500/60 flex items-center justify-center shadow-sm">
                <UploadCloud className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase flex items-center gap-2 font-mono">
                  Sube tu Material de Estudio
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  PDFs, imágenes, audios o enlaces de YouTube para generar tu tablero de juego.
                </p>
              </div>
            </div>
          </div>

          {/* Contenido Unificado */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-[#0f172a]">
            
            {/* ZONA UNIFICADA DE CARGA (PDFs, Imágenes, Audios) */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-arcade p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                isDraggingOver
                  ? 'border-emerald-400 bg-emerald-950/40 shadow-sm scale-[0.99]'
                  : 'border-slate-700 hover:border-emerald-500/60 bg-slate-900/70 hover:bg-slate-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.m4a"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Iconos de los tipos permitidos juntos */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-arcade-sm bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-arcade-sm bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-sm">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-arcade-sm bg-sky-950 border border-sky-500/50 flex items-center justify-center text-sky-400 shadow-sm">
                  <Music className="w-5 h-5" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-white">
                Arrastra aquí tu <span className="text-rose-400 font-semibold">PDF</span>, <span className="text-emerald-400 font-semibold">Imagen</span> o <span className="text-sky-400 font-semibold">Audio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                o haz clic para buscar en tu dispositivo
              </p>

              <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800 shadow-xs">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Formatos soportados: .pdf, .png, .jpg, .mp3, .wav, .m4a</span>
              </div>
            </div>

            {/* SECCIÓN LINK DE YOUTUBE */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-arcade p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-slate-200">
                  ¿Tienes un video de clase o lección en YouTube?
                </span>
              </div>

              <form onSubmit={handleAddYoutube} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setUrlError('');
                    }}
                    placeholder="Pega aquí el enlace de YouTube: https://www.youtube.com/watch?v=..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-arcade-sm py-2 pl-3 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-sans shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!youtubeUrl.trim()}
                  className="px-4 py-2 rounded-arcade-sm bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-bold text-xs uppercase font-mono tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </form>
              {urlError && (
                <p className="text-[11px] text-rose-400 mt-1 font-mono">{urlError}</p>
              )}
            </div>

            {/* LISTA UNIFICADA DE ARCHIVOS Y ENLACES AGREGADOS */}
            {files.length > 0 && (
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Material cargado ({files.length})
                </h4>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-700/80 rounded-arcade-sm hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                          {file.type === 'document' ? <FileText className="w-4 h-4 text-rose-400" /> :
                           file.type === 'image' ? <ImageIcon className="w-4 h-4 text-emerald-400" /> :
                           file.type === 'youtube' ? <Video className="w-4 h-4 text-rose-400" /> :
                           <Music className="w-4 h-4 text-sky-400" />}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{file.size} • {file.type.toUpperCase()}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pie del Modal */}
          <div className="p-4 sm:p-5 border-t border-slate-700/80 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Gemini y RAG listos</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={isProcessing || files.length === 0}
                onClick={handleStartGame}
                className={`px-6 py-2.5 rounded-arcade-sm font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                  files.length === 0 || isProcessing
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 cursor-pointer'
                }`}
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Ingiriendo...</span>
                  </>
                ) : (
                  <>
                    <span>Generar Tablero</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
