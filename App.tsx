
import React, { useState, useEffect, useRef } from 'react';
import { UploadZone } from './components/UploadZone';
import { UploadedFile, GenerationState, HistoryItem, AspectRatio } from './types';
import { GoogleGenAI } from '@google/genai';
import { 
  Wand2, Download, AlertCircle, Loader2, 
  Type, LayoutTemplate, Palette, Layers, Box, Eraser, 
  PanelLeft, RotateCcw, RotateCw, History, Ratio, Trash2, PenTool,
  CheckSquare, Square, ShieldCheck, Zap, Sparkles
} from 'lucide-react';
import { downloadImage } from './utils';

type BackgroundStyle = 'normal' | 'blur' | 'bw' | 'brand' | 'random';
type QualityMode = 'standard' | 'pro';

export default function App() {
  // Image References
  const [heroImage1, setHeroImage1] = useState<UploadedFile | null>(null);
  const [heroImage2, setHeroImage2] = useState<UploadedFile | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<UploadedFile | null>(null);
  
  const [moodboard, setMoodboard] = useState<UploadedFile | null>(null);
  const [typeface, setTypeface] = useState<UploadedFile | null>(null);
  const [assets, setAssets] = useState<UploadedFile | null>(null);

  // Text Content
  const [headline, setHeadline] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [artDirection, setArtDirection] = useState<string>('');
  
  // Advanced Controls
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>('normal');
  const [matchMoodboardCTA, setMatchMoodboardCTA] = useState<boolean>(false);
  const [safeZone, setSafeZone] = useState<boolean>(true);

  // Config
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('4:5');
  const [qualityMode, setQualityMode] = useState<QualityMode>('pro');

  // Generation & Edit State
  const [generation, setGeneration] = useState<GenerationState>({ isLoading: false });
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [editRefImage, setEditRefImage] = useState<UploadedFile | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<boolean>(false);

  // UI State
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    } catch (e) {
      console.error("Failed to check API key status", e);
    }
  };

  const handleConnect = async () => {
    setApiKeyError(false);
    try {
      if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      }
    } catch (error) {
      console.error("API Key selection failed", error);
      setApiKeyError(true);
      setHasApiKey(false);
    }
  };

  const addToHistory = (base64Image: string, type: 'initial' | 'edit') => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      image: base64Image,
      promptType: type,
      timestamp: Date.now()
    };

    // If we are in the middle of history, truncate the future
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newItem);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setGeneration(prev => ({ ...prev, resultImage: history[newIndex].image }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setGeneration(prev => ({ ...prev, resultImage: history[newIndex].image }));
    }
  };

  const jumpToHistory = (index: number) => {
    setHistoryIndex(index);
    setGeneration(prev => ({ ...prev, resultImage: history[index].image }));
  };

  const handleGenerate = async (isEdit: boolean = false) => {
    if (!hasApiKey) {
      setApiKeyError(true);
      return;
    }

    if (!isEdit && !artDirection.trim() && !headline.trim() && !heroImage1) {
      alert("Please provide at least a Headline, Art Direction, or a Hero Image.");
      return;
    }
    
    if (isEdit && !editPrompt.trim()) {
      alert("Please describe what you want to change.");
      return;
    }

    setGeneration(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const parts: any[] = [];

      // MODEL SELECTION LOGIC
      // 'pro' uses gemini-3-pro-image-preview
      // 'standard' uses gemini-2.5-flash-image
      const selectedModel = qualityMode === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

      // CONFIGURATION LOGIC
      // Only Pro supports 'imageSize'
      const imageConfig: any = {
        aspectRatio: selectedRatio
      };
      if (qualityMode === 'pro') {
        imageConfig.imageSize = "1K"; 
      }

      // EDIT MODE LOGIC
      if (isEdit && generation.resultImage) {
        // Remove data prefix for API
        const base64Image = generation.resultImage.split(',')[1];
        
        parts.push({ text: "INPUT_IMAGE (This is the image to edit/refine):" });
        parts.push({ inlineData: { mimeType: 'image/png', data: base64Image } });
        
        if (editRefImage) {
          parts.push({ text: "REF_EDIT_ASSET (Add or use this element during the edit):" });
          parts.push({ inlineData: { mimeType: editRefImage.mimeType, data: editRefImage.base64 } });
        }
        
        parts.push({ text: `INSTRUCTION: Modify the input image based on this request: "${editPrompt}". Keep the quality high. ${editRefImage ? "Incorporate the REF_EDIT_ASSET naturally." : ""}` });
      
      } else {
        // GENERATION MODE LOGIC
        
        // 1. Hero Images (The Subjects)
        if (heroImage1) {
          parts.push({ text: "REF_HERO_1 (PRIMARY SUBJECT - Product/Person to feature. Keep unaltered if possible):" });
          parts.push({ inlineData: { mimeType: heroImage1.mimeType, data: heroImage1.base64 } });
        }

        if (heroImage2) {
          parts.push({ text: "REF_HERO_2 (SECONDARY SUBJECT - Accompanying item/detail):" });
          parts.push({ inlineData: { mimeType: heroImage2.mimeType, data: heroImage2.base64 } });
        }

        // 2. Background / Environment
        if (backgroundImage) {
          parts.push({ text: "REF_BACKGROUND (Use this as the environment/backdrop):" });
          parts.push({ inlineData: { mimeType: backgroundImage.mimeType, data: backgroundImage.base64 } });
        }

        // 3. Brand Assets (Logo/Colors)
        if (assets) {
          parts.push({ text: "REF_BRAND_ASSETS (CRITICAL: Use this Logo. EXTRACT EXACT COLORS from this image for the post palette):" });
          parts.push({ inlineData: { mimeType: assets.mimeType, data: assets.base64 } });
        }

        // 4. Style & Type
        if (moodboard) {
          parts.push({ text: "REF_STYLE_MOODBOARD (Lighting, Texture, Composition vibe):" });
          parts.push({ inlineData: { mimeType: moodboard.mimeType, data: moodboard.base64 } });
        }

        if (typeface) {
          parts.push({ text: "REF_TYPOGRAPHY (Mimic this font style/weight):" });
          parts.push({ inlineData: { mimeType: typeface.mimeType, data: typeface.base64 } });
        }

        // Determine Background Logic
        let bgPromptAddon = "";
        switch (bgStyle) {
          case 'blur':
            bgPromptAddon = "Apply a strong Gaussian Blur (Bokeh) to the background to separate it from the subject.";
            break;
          case 'bw':
            bgPromptAddon = "The background must be Black & White (Monochrome), while the subject stays colored.";
            break;
          case 'brand':
             bgPromptAddon = assets ? "Generate the background strictly using the dominant BRAND COLORS from 'REF_BRAND_ASSETS'." : "Use a strong color block background.";
             break;
          case 'random':
             bgPromptAddon = "Use a creative, high-impact background that contrasts well with the subject.";
             break;
          default:
             bgPromptAddon = "Keep the background professional and consistent with the scene.";
             break;
        }

        const bgInstruction = backgroundImage 
          ? `- **ENVIRONMENT**: Use 'REF_BACKGROUND' as the base layer. ${bgPromptAddon}`
          : assets 
            ? `- **ENVIRONMENT**: No background image provided. ${bgPromptAddon} (derived from 'REF_BRAND_ASSETS' or 'REF_STYLE_MOODBOARD').`
            : `- **ENVIRONMENT**: Generate a high-end studio background. ${bgPromptAddon}`;

        const mainPrompt = `
          You are an elite digital designer creating a high-fidelity social media post (Aspect Ratio: ${selectedRatio}).
          
          ### LAYERING & COMPOSITION (CRITICAL)
          1. **LAYER 1 (BOTTOM)**: Background/Environment. ${bgInstruction}
          2. **LAYER 2 (MIDDLE)**: Hero Subjects. Place 'REF_HERO_1' ${heroImage2 ? "and 'REF_HERO_2'" : ""} in the scene.
          3. **LAYER 3 (TOP)**: Text Overlay & UI Elements. All text MUST be rendered ON TOP of the hero subjects and background. DO NOT let the subject cover the text.
          
          ### LAYOUT CONSTRAINTS
          ${safeZone ? "- **SAFE ZONE**: CRITICAL! Maintain generous padding around all edges. No text or logos should touch the border. Keep content centered within a safe area." : ""}
          
          ### HERO INTEGRATION
          ${heroImage1 ? "- **REF_HERO_1**: Integrate as the primary subject." : ""}
          ${heroImage2 ? "- **REF_HERO_2**: Place alongside the primary." : ""}
          
          ### BRANDING
          ${assets ? "- **LOGO**: You MUST incorporate the logo from 'REF_BRAND_ASSETS' in a tasteful location (Top Center or Corner)." : ""}
          ${assets ? "- **COLORS**: STRICTLY use the color palette found in 'REF_BRAND_ASSETS'." : "- Use a premium, dark studio palette."}

          ### TEXT CONTENT (RENDER ON TOP LAYER)
          Render the following text elements with professional typography. Ensure high contrast against the background and NO OBSTRUCTION by the hero image:
          ${headline ? `- HEADLINE (Dominant): "${headline}"` : ''}
          ${subtitle ? `- SUBTITLE: "${subtitle}"` : ''}
          ${bodyText ? `- BODY COPY: "${bodyText}"` : ''}
          ${contactInfo ? `- CTA/FOOTER: "${contactInfo}" ${matchMoodboardCTA && moodboard ? "(Style this CTA visually similar to buttons/calls-to-action found in 'REF_STYLE_MOODBOARD')" : ""}` : ''}
          
          ### STYLE DIRECTIVES
          ${moodboard ? "- Follow the aesthetic direction (lighting, mood, texture) of 'REF_STYLE_MOODBOARD'." : "- Create a modern, professional editorial look."}
          ${typeface ? "- Match the font personality of 'REF_TYPOGRAPHY'." : "- Use modern, clean sans-serif typography (Inter/Helvetica style)."}

          ### ART DIRECTION
          ${artDirection || "Make it look expensive, high-contrast, and professional."}
        `;

        parts.push({ text: mainPrompt });
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts: parts },
        config: {
          imageConfig: imageConfig
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const fullImage = `data:${mimeType};base64,${base64Data}`;
            
            setGeneration({
              isLoading: false,
              resultImage: fullImage
            });
            addToHistory(fullImage, isEdit ? 'edit' : 'initial');
            
            foundImage = true;
            // Exit edit mode if successful
            if (isEdit) {
                setEditPrompt('');
                setEditRefImage(null);
                setIsEditMode(false);
            }
            break;
          }
        }
      }

      if (!foundImage) {
         const textOutput = response.text;
         throw new Error(textOutput || "No image was generated.");
      }

    } catch (err: any) {
      let errorMessage = "An unexpected error occurred.";
      if (err.message) errorMessage = err.message;
      setGeneration(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const resetAll = () => {
    if(confirm("Start new project? This will clear all assets and history.")) {
      setHeroImage1(null);
      setHeroImage2(null);
      setBackgroundImage(null);
      setAssets(null);
      setMoodboard(null);
      setTypeface(null);
      setHeadline('');
      setSubtitle('');
      setBodyText('');
      setContactInfo('');
      setArtDirection('');
      setGeneration({ isLoading: false });
      setIsEditMode(false);
      setHistory([]);
      setHistoryIndex(-1);
      setBgStyle('normal');
      setSafeZone(true);
      setMatchMoodboardCTA(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-studio-950 text-studio-200 font-sans overflow-hidden">
      
      {/* ---------------- LEFT SIDEBAR: PROPERTIES PANEL ---------------- */}
      <aside className="w-[360px] flex-shrink-0 flex flex-col border-r border-studio-800 bg-studio-900 z-10 shadow-xl">
        
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-studio-800 bg-studio-950">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent-600 rounded-sm flex items-center justify-center">
              <Box size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-sm tracking-wide text-white">eyeroniq <span className="text-studio-500 font-normal">STUDIO</span></h1>
          </div>
          <div className="flex items-center gap-2">
             {!hasApiKey && (
                <button onClick={handleConnect} className="text-xs bg-studio-800 hover:bg-studio-700 px-2 py-1 rounded text-accent-500 border border-studio-700">Connect Key</button>
             )}
             <button onClick={resetAll} className="p-1.5 hover:bg-studio-800 rounded text-studio-500 hover:text-studio-300" title="Reset Project">
               <Trash2 size={14} />
             </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          
          {/* SECTION 1: ASSETS */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-studio-100 font-semibold text-xs uppercase tracking-wider">
               <Layers size={12} className="text-accent-500" /> Project Assets
             </div>
             
             <div className="grid grid-cols-2 gap-2">
                <UploadZone label="Hero Product 1" description="Main Subject" value={heroImage1} onChange={setHeroImage1} compact />
                <UploadZone label="Hero Product 2" description="Secondary" value={heroImage2} onChange={setHeroImage2} compact />
                <UploadZone label="Background" description="Env / Scene" value={backgroundImage} onChange={setBackgroundImage} compact />
                <UploadZone label="Brand Kit" description="Logo & Colors" value={assets} onChange={setAssets} compact />
             </div>
             
             {/* Background Style Control */}
             <div className="mt-2">
                <label className="text-[10px] font-semibold text-studio-400 uppercase tracking-tight block mb-1.5">Background Style</label>
                <div className="grid grid-cols-5 gap-1">
                   {(['normal', 'blur', 'bw', 'brand', 'random'] as BackgroundStyle[]).map(style => (
                     <button
                        key={style}
                        onClick={() => setBgStyle(style)}
                        className={`
                          py-1.5 text-[9px] font-bold uppercase rounded border transition-colors truncate px-1
                          ${bgStyle === style 
                             ? 'bg-studio-200 border-studio-200 text-studio-950' 
                             : 'bg-studio-900 border-studio-700 text-studio-500 hover:border-studio-500 hover:text-studio-300'
                          }
                        `}
                        title={style}
                     >
                       {style}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          <div className="h-px bg-studio-800 w-full"></div>

          {/* SECTION 2: FORMAT */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-studio-100 font-semibold text-xs uppercase tracking-wider">
               <Ratio size={12} className="text-accent-500" /> Output Format
             </div>
             
             {/* Quality Mode Toggle */}
             <div className="grid grid-cols-2 gap-1 bg-studio-950 p-1 rounded-md border border-studio-800">
                <button
                   onClick={() => setQualityMode('standard')}
                   className={`
                      flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all
                      ${qualityMode === 'standard' 
                        ? 'bg-studio-800 text-white shadow-sm' 
                        : 'text-studio-500 hover:text-studio-300'
                      }
                   `}
                >
                   <Zap size={10} /> Flash 2.5
                </button>
                <button
                   onClick={() => setQualityMode('pro')}
                   className={`
                      flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold uppercase transition-all
                      ${qualityMode === 'pro' 
                        ? 'bg-indigo-900/50 text-indigo-200 shadow-sm border border-indigo-500/30' 
                        : 'text-studio-500 hover:text-studio-300'
                      }
                   `}
                >
                   <Sparkles size={10} /> Pro 3
                </button>
             </div>

             <div className="grid grid-cols-6 gap-1">
                {(['1:1', '4:5', '3:4', '4:3', '16:9', '9:16'] as AspectRatio[]).map((ratio) => (
                   <button
                     key={ratio}
                     onClick={() => setSelectedRatio(ratio)}
                     className={`
                       py-1.5 text-[9px] font-bold rounded border transition-colors
                       ${selectedRatio === ratio 
                          ? 'bg-accent-600 border-accent-500 text-white' 
                          : 'bg-studio-950 border-studio-800 text-studio-500 hover:border-studio-600 hover:text-studio-300'
                       }
                     `}
                   >
                     {ratio}
                   </button>
                ))}
             </div>
             
             {/* Safe Zone Toggle */}
             <button 
                onClick={() => setSafeZone(!safeZone)}
                className={`
                   w-full flex items-center justify-between px-3 py-2 rounded border text-xs font-medium transition-colors
                   ${safeZone ? 'bg-studio-800 border-accent-500/50 text-accent-400' : 'bg-studio-950 border-studio-800 text-studio-500'}
                `}
             >
                <span className="flex items-center gap-2"><ShieldCheck size={12} /> Safe Zone Padding</span>
                {safeZone ? <CheckSquare size={14} /> : <Square size={14} />}
             </button>
          </div>

          <div className="h-px bg-studio-800 w-full"></div>

          {/* SECTION 3: STYLE */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-studio-100 font-semibold text-xs uppercase tracking-wider">
               <Palette size={12} className="text-accent-500" /> Style Reference
             </div>
             <div className="grid grid-cols-2 gap-2">
                <UploadZone label="Moodboard" description="Vibe" value={moodboard} onChange={setMoodboard} compact />
                <UploadZone label="Typography" description="Font Style" value={typeface} onChange={setTypeface} compact />
             </div>
          </div>

          <div className="h-px bg-studio-800 w-full"></div>

          {/* SECTION 4: COPY */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-studio-100 font-semibold text-xs uppercase tracking-wider">
               <Type size={12} className="text-accent-500" /> Typography & Copy
             </div>
             
             <div className="space-y-2">
               <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" className="w-full bg-studio-950 border border-studio-700 rounded px-2 py-1.5 text-sm focus:border-accent-500 focus:outline-none placeholder:text-studio-600" />
               <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" className="w-full bg-studio-950 border border-studio-700 rounded px-2 py-1.5 text-sm focus:border-accent-500 focus:outline-none placeholder:text-studio-600" />
                  <input type="text" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="CTA / Footer" className="w-full bg-studio-950 border border-studio-700 rounded px-2 py-1.5 text-sm focus:border-accent-500 focus:outline-none placeholder:text-studio-600" />
               </div>
               
               <div className="flex items-center gap-2 px-1 pt-1">
                 <button 
                    onClick={() => setMatchMoodboardCTA(!matchMoodboardCTA)}
                    disabled={!moodboard}
                    className={`text-[10px] flex items-center gap-1.5 transition-colors ${!moodboard ? 'text-studio-600 cursor-not-allowed' : 'text-studio-400 hover:text-white cursor-pointer'}`}
                    title={!moodboard ? "Please upload a Moodboard first" : "Match style"}
                 >
                   {matchMoodboardCTA ? <CheckSquare size={12} className={!moodboard ? "text-studio-600" : "text-accent-500"} /> : <Square size={12} />}
                   Match CTA style to Moodboard {(!moodboard) && "(Req. Moodboard)"}
                 </button>
               </div>

               <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={2} placeholder="Body copy..." className="w-full bg-studio-950 border border-studio-700 rounded px-2 py-1.5 text-sm focus:border-accent-500 focus:outline-none placeholder:text-studio-600 resize-none" />
             </div>
          </div>

          <div className="h-px bg-studio-800 w-full"></div>

          {/* SECTION 5: ART DIRECTION */}
           <div className="space-y-3">
             <div className="flex items-center gap-2 text-studio-100 font-semibold text-xs uppercase tracking-wider">
               <LayoutTemplate size={12} className="text-accent-500" /> Director's Notes
             </div>
             <textarea 
               value={artDirection} 
               onChange={(e) => setArtDirection(e.target.value)} 
               rows={4} 
               placeholder="Detailed instructions (e.g. 'Dark, misty atmosphere with neon rim lighting')" 
               className="w-full bg-studio-950 border border-studio-700 rounded px-3 py-2 text-sm focus:border-accent-500 focus:outline-none placeholder:text-studio-600 resize-none" 
             />
          </div>

        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-studio-800 bg-studio-950">
           <button
              onClick={() => handleGenerate(false)}
              disabled={generation.isLoading || !hasApiKey}
              className={`
                w-full py-3 rounded font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-all
                ${generation.isLoading || !hasApiKey
                  ? 'bg-studio-800 text-studio-500 cursor-not-allowed'
                  : 'bg-accent-600 text-white hover:bg-accent-500 shadow-lg shadow-accent-900/20'
                }
              `}
            >
              {generation.isLoading ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
              {generation.isLoading ? 'Rendering...' : 'Generate Asset'}
            </button>
        </div>
      </aside>

      {/* ---------------- CENTER & RIGHT ---------------- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CENTER: CANVAS AREA */}
        <main className="flex-1 flex flex-col relative bg-studio-950">
          
          {/* Toolbar */}
          <div className="h-10 border-b border-studio-800 bg-studio-900 flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-studio-500 uppercase flex items-center gap-1">
                  Aspect: <span className="text-studio-300">{selectedRatio}</span>
                </span>
                <div className="h-4 w-px bg-studio-800"></div>
                <span className="text-xs font-medium text-studio-500 uppercase flex items-center gap-1">
                  Model: <span className={qualityMode === 'pro' ? 'text-indigo-400' : 'text-studio-300'}>{qualityMode === 'pro' ? 'Gemini 3 Pro' : 'Flash 2.5'}</span>
                </span>
                <div className="h-4 w-px bg-studio-800"></div>
                {/* History Controls */}
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleUndo} 
                    disabled={historyIndex <= 0}
                    className="p-1 rounded text-studio-400 hover:text-white disabled:opacity-30 disabled:hover:text-studio-400"
                    title="Undo"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button 
                    onClick={handleRedo} 
                    disabled={historyIndex >= history.length - 1}
                    className="p-1 rounded text-studio-400 hover:text-white disabled:opacity-30 disabled:hover:text-studio-400"
                    title="Redo"
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
            </div>
            {generation.resultImage && (
                <button 
                  onClick={() => generation.resultImage && downloadImage(generation.resultImage, 'eyeroniq-export.png')}
                  className="flex items-center gap-1.5 text-xs font-medium text-studio-300 hover:text-white transition-colors"
                >
                  <Download size={14} /> EXPORT PNG
                </button>
            )}
          </div>

          {/* Canvas Viewport */}
          <div className="flex-1 overflow-hidden relative checkerboard flex items-center justify-center p-8" ref={canvasRef}>
              
              {generation.resultImage ? (
                <div className="relative shadow-2xl shadow-black ring-1 ring-white/10 max-h-full max-w-full">
                  <img src={generation.resultImage} alt="Render" className="max-h-[calc(100vh-140px)] object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-studio-600 select-none">
                    {generation.error ? (
                      <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-lg text-center max-w-md">
                        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <p className="text-red-200 text-sm">{generation.error}</p>
                        {generation.error.includes("API Key") && <button onClick={handleConnect} className="mt-4 text-xs underline">Reconnect</button>}
                      </div>
                    ) : (
                      <>
                        <PanelLeft size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No active render</p>
                        <p className="text-xs opacity-60">Configure parameters in the left panel to start.</p>
                      </>
                    )}
                </div>
              )}

              {/* Loading Overlay */}
              {generation.isLoading && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-accent-500 animate-spin mb-4" />
                  <span className="text-white font-mono text-sm tracking-widest">RENDERING...</span>
                </div>
              )}
          </div>

          {/* ---------------- EDIT TOOLBAR (Bottom) ---------------- */}
          {generation.resultImage && !generation.isLoading && (
            <div className={`
                absolute bottom-0 left-0 right-0 border-t border-studio-800 bg-studio-900/95 backdrop-blur shadow-2xl transition-all duration-300 z-40
                ${isEditMode ? 'h-48' : 'h-14'}
            `}>
                {!isEditMode ? (
                  <div className="h-full flex items-center justify-center">
                      <button 
                        onClick={() => setIsEditMode(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-studio-800 hover:bg-studio-700 rounded-full border border-studio-700 text-sm font-medium text-studio-200 transition-all hover:border-accent-500/50"
                      >
                        <PenTool size={14} /> Make Edits / Refine
                      </button>
                  </div>
                ) : (
                  <div className="h-full p-4 flex gap-4 max-w-5xl mx-auto">
                      {/* Close Edit */}
                      <button onClick={() => setIsEditMode(false)} className="absolute top-2 right-2 text-studio-500 hover:text-white">
                        <Eraser size={14} />
                      </button>

                      <div className="w-1/3 border-r border-studio-700 pr-4">
                        <label className="text-xs font-semibold text-studio-400 uppercase tracking-tight mb-2 block">Reference Asset (Optional)</label>
                        <UploadZone label="New Element" description="Icon/Image" value={editRefImage} onChange={setEditRefImage} compact />
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-semibold text-studio-400 uppercase tracking-tight">Edit Instructions</label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="What should be changed? (e.g. 'Change background to dark blue', 'Add the reference icon to bottom right')"
                          className="flex-1 bg-studio-950 border border-studio-700 rounded p-3 text-sm focus:border-accent-500 focus:outline-none resize-none"
                        />
                        <button
                          onClick={() => handleGenerate(true)}
                          className="bg-accent-600 hover:bg-accent-500 text-white text-xs font-bold uppercase tracking-wide py-2 rounded flex items-center justify-center gap-2"
                        >
                          <Wand2 size={12} /> Render Changes
                        </button>
                      </div>
                  </div>
                )}
            </div>
          )}
        </main>

        {/* ---------------- RIGHT SIDEBAR: HISTORY ---------------- */}
        <aside className="w-56 border-l border-studio-800 bg-studio-900 flex flex-col z-10">
           <div className="h-10 flex items-center px-4 border-b border-studio-800 bg-studio-950">
              <span className="text-xs font-semibold text-studio-400 uppercase tracking-wider flex items-center gap-2">
                <History size={12} /> Version History
              </span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center p-4 text-studio-600 text-xs">
                   No history yet.
                </div>
              ) : (
                history.map((item, index) => (
                  <div 
                    key={item.id}
                    onClick={() => jumpToHistory(index)}
                    className={`
                      cursor-pointer rounded-lg overflow-hidden border transition-all relative group
                      ${index === historyIndex 
                         ? 'border-accent-500 ring-1 ring-accent-500/50' 
                         : 'border-studio-700 hover:border-studio-500'
                      }
                    `}
                  >
                     <div className="aspect-square w-full bg-studio-950 checkerboard">
                        <img src={item.image} className="w-full h-full object-contain" alt="History Item" />
                     </div>
                     <div className="p-2 bg-studio-800">
                        <div className="flex justify-between items-center mb-1">
                           <span className={`text-[10px] font-bold uppercase ${item.promptType === 'edit' ? 'text-blue-400' : 'text-studio-300'}`}>
                             {item.promptType === 'initial' ? 'Generation' : 'Refinement'}
                           </span>
                           <span className="text-[9px] text-studio-500">
                              {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                     </div>
                     {index === historyIndex && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full shadow-lg shadow-accent-500/50"></div>
                     )}
                  </div>
                ))
              )}
           </div>
        </aside>

      </div>
    </div>
  );
}
