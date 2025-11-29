import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { UploadedFile } from '../types';
import { fileToBase64 } from '../utils';

interface UploadZoneProps {
  label: string;
  description: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  accept?: string;
  compact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  label,
  description,
  value,
  onChange,
  accept = "image/*",
  compact = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        const previewUrl = URL.createObjectURL(file);
        onChange({
          file,
          previewUrl,
          base64,
          mimeType: file.type
        });
      } catch (err) {
        console.error("Error reading file", err);
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-xs font-semibold text-studio-400 uppercase tracking-tight">{label}</label>
        {value && (
          <button 
            onClick={handleRemove}
            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-950/30 px-1.5 py-0.5 rounded"
          >
            <X size={10} /> CLEAR
          </button>
        )}
      </div>
      
      <div 
        onClick={handleClick}
        className={`
          relative group cursor-pointer 
          border border-dashed rounded-lg transition-all duration-200
          ${value 
            ? 'border-studio-500 bg-studio-900' 
            : 'border-studio-700 hover:border-studio-500 hover:bg-studio-800/50 bg-studio-900/50'
          }
          ${compact ? 'h-24' : 'h-32'}
          flex flex-col items-center justify-center overflow-hidden
        `}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleFileChange}
        />

        {value ? (
          <div className="relative w-full h-full flex items-center justify-center p-1">
             <img 
               src={value.previewUrl} 
               alt="Preview" 
               className="w-full h-full object-contain rounded-sm"
             />
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-medium flex items-center gap-1.5">
                  <Upload size={14} /> REPLACE
                </span>
             </div>
          </div>
        ) : (
          <div className="text-center p-2">
            <div className="w-8 h-8 rounded bg-studio-800 flex items-center justify-center mx-auto mb-2 group-hover:bg-studio-700 transition-colors">
              <ImageIcon className="text-studio-500 group-hover:text-studio-300 transition-colors" size={16} />
            </div>
            {!compact && <p className="text-xs text-studio-500 font-medium">{description}</p>}
          </div>
        )}
      </div>
    </div>
  );
};