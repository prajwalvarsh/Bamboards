import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipData {
  [word: string]: {
    [day: string]: {
      [role: string]: string;
    };
  };
}

interface TooltipManagerProps {
  word: string | null;
  selectedDay: string;
  selectedRole: string;
  mousePosition: { x: number; y: number } | null;
}

// Expanded lexicons (English + German) with common stems/forms
const positiveLexicon = new Set([
  // English
  'good','great','positive','benefit','help','support','improve','love','like','enjoy','useful','usefulness','successful','success','better','efficient','easy','welcome','satisfied','satisfaction','recommend','recommendation','comfortable','accessible','accessible','pleasant','clear','friendly','fast','reliable','stable','works','working','workingwell',
  // German
  'gut','positiv','nutzen','nützlich','hilfe','hilfreich','verbessern','besser','einfach','gern','lieben','mögen','zufrieden','zufriedenheit','praktisch','erfolgreich','erfolg','angenehm','zugänglich','schnell','zuverlässig','funktioniert','funktioniertet'
]);

const negativeLexicon = new Set([
  // English
  'bad','problem','issue','concern','complain','complaint','difficult','hard','worse','fail','failure','avoid','annoy','frustrat','late','unreliable','slow','broken','brokenly','crash','crashes','error','errors','not','no','lack','missing','unclear','confusing','difficulties',
  // German
  'schlecht','problem','probleme','beschwer','sorgen','unsicher','schwierig','schwierigkeit','frustriert','ärger','ärgerlich','vermeiden','verspät','spät','fehler','stört','langsam','kaputt','defekt','absturz','fehlerhaft','fehlend','unklar','verwirrend'
]);

// Phase-specific keywords to bias sentiment detection per phase
const phasePositive = {
  Discover: new Set(['interesting','insight','curious','discover','learn','insightful','aufmerksamkeit','interessant','entdecken']),
  Define: new Set(['clarify','clear','prioritize','focus','soll','klar','präzise','priorisieren']),
  Develop: new Set(['prototype','improve','iteration','develop','build','implement','verbessern','testen','testen','prototyp']),
  Deliver: new Set(['deploy','launch','release','rollout','implement','erfolgreich','bereit','veröffentlichen'])
};

const phaseNegative = {
  Discover: new Set(['confusing','unclear','no-insight','kein','unsure','unklar','unbekannt']),
  Define: new Set(['ambiguous','contradictory','conflict','worse','ungeklärt','widersprüchlich']),
  Develop: new Set(['bug','crash','broken','slow','notworking','fehler','absturz','langsam','kaputt']),
  Deliver: new Set(['delay','late','blocked','blocked-deploy','verspätung','verzögerung','blockiert'])
};

const TooltipManager: React.FC<TooltipManagerProps> = ({
  word,
  selectedDay,
  selectedRole,
  mousePosition,
}) => {
  const [tooltipData, setTooltipData] = useState<TooltipData>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load tooltip data
  useEffect(() => {
    const loadTooltipData = async () => {
      try {
        // Prefer the structured keywords JSON served from /api/wordcloud
        const response = await fetch('/api/wordcloud?v=' + Date.now(), {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }); // Aggressive cache busting
        const data = await response.json();
        // Convert array into lookup map keyed by normalized keyword
        const map: TooltipData = {};
        data.forEach((item: any) => {
          // --- SENTIMENT TAGGING (lexicon) ---
          // If sentiment exists already, keep it; otherwise run simple lexicon scan
          if (!item.sentiment) {
            const textToScan = ((item.roles?.citizen?.original_sentence || '') + ' ' + (item.keyword || '')).toLowerCase();
            let score = 0;
            // quick tokenization by non-word chars
            const tokens = textToScan.split(/[^a-z0-9äöüß]+/i).filter(Boolean);
            for (const t of tokens) {
              if (positiveLexicon.has(t)) score += 1;
              if (negativeLexicon.has(t)) score -= 1;
            }
            if (score > 0) item.sentiment = 'positive';
            else if (score < 0) item.sentiment = 'negative';
            else item.sentiment = 'neutral';
          }

          const key = (item.keyword || '').toLowerCase();
          map[key] = map[key] || {};
          // store full item so we can access roles and source
          (map[key] as any).item = item;
        });
        setTooltipData(map);
      } catch (error) {
        console.error('Failed to load tooltip data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTooltipData();
  }, []);

  // Get tooltip item (full structured entry)
  const getTooltipItem = (word: string) => {
    if (isLoading) return null;
    const key = word.toLowerCase();
    const entry = (tooltipData as any)[key];
    return entry?.item || null;
  };

  // Get tooltip position
  const getTooltipPosition = () => {
    if (!mousePosition) return { x: 0, y: 0 };
    
    const tooltipWidth = 320;
    const tooltipHeight = 120;
    const padding = 16;
    
    let x = mousePosition.x + padding;
    let y = mousePosition.y - tooltipHeight - padding;
    
    // Adjust if tooltip would go off screen
    if (x + tooltipWidth > window.innerWidth) {
      x = mousePosition.x - tooltipWidth - padding;
    }
    
    if (y < 0) {
      y = mousePosition.y + padding;
    }
    
    return { x, y };
  };

  // Get role-specific styling
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Citizen':
        return 'bg-green-500';
      case 'Designer':
        return 'bg-blue-500';
      case 'Planner':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Citizen':
        return '👥';
      case 'Designer':
        return '🎨';
      case 'Planner':
        return '📋';
      default:
        return '💭';
    }
  };

  if (!word || !mousePosition) return null;

  const tooltipItem = word ? getTooltipItem(word) : null;
  const position = getTooltipPosition();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed z-50 pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
        }}
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-3">
            <div className={`w-3 h-3 rounded-full ${getRoleColor(selectedRole)}`}></div>
            <span className="text-sm font-medium text-gray-600">
              {getRoleIcon(selectedRole)} {selectedRole} • {selectedDay}
            </span>
          </div>
          
          {/* Word */}
          <div className="mb-2">
            <span className="text-lg font-semibold text-gray-900 capitalize">
              "{word}"
            </span>
          </div>
          
          {/* Content: show all roles + source */}
          <div className="text-sm text-gray-700 leading-relaxed space-y-3">
            {tooltipItem ? (
              <>
                {/* show only filename for source */}
                <div className="text-xs text-gray-500">Source: <span className="font-medium text-gray-700">{(tooltipItem.source || '').split(/\\|\//).pop()}</span></div>

                {/* Sentiment */}
                <div className="text-xs">Sentiment: <span className="font-medium text-gray-700 capitalize">{tooltipItem.sentiment || 'neutral'}</span></div>

                <div className="grid grid-cols-1 gap-2">
                  {/* Citizen only when Citizen view is selected */}
                  {selectedRole === 'Citizen' && (
                    <div>
                      <div className="text-xs font-semibold text-green-600 flex items-center gap-2">{getRoleIcon('Citizen')} Citizen</div>
                      <div className="text-sm text-gray-800">{tooltipItem.roles?.citizen?.original_sentence || '—'}</div>
                    </div>
                  )}

                  {/* Designer suggestion only when Designer view is selected */}
                  {selectedRole === 'Designer' && (
                    <div>
                      <div className="text-xs font-semibold text-blue-600 flex items-center gap-2">{getRoleIcon('Designer')} Designer</div>
                      <div className="text-sm text-gray-800">{tooltipItem.roles?.designer?.design_suggestion || '—'}</div>
                    </div>
                  )}

                  {/* Planner suggestion only when Planner view is selected */}
                  {selectedRole === 'Planner' && (
                    <div>
                      <div className="text-xs font-semibold text-purple-600 flex items-center gap-2">{getRoleIcon('Planner')} Planner</div>
                      <div className="text-sm text-gray-800">{tooltipItem.roles?.planner?.planning_suggestion || '—'}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>Loading...</div>
            )}
          </div>
          
          {/* Arrow */}
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TooltipManager;