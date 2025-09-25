import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WordCloud from '../components/WordCloud';
import TooltipManager from '../components/TooltipManager';
import Head from 'next/head';

interface WordData {
  text: string;
  size: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  frequency?: number;
}

const PHASES = ['Discover', 'Define', 'Develop', 'Deliver'];
const ROLES = ['Citizen', 'Designer', 'Planner'];

// The frontend will request structured keywords from the API and group them by phase.
type PhaseMap = { [phase: string]: WordData[] };

export default function Home() {
  const [selectedPhase, setSelectedPhase] = useState('Discover');
  const [selectedRole, setSelectedRole] = useState('Citizen');
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [phaseMap, setPhaseMap] = useState<PhaseMap>({});

  // Track global mouse position when hovering over words
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (hoveredWord) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    };

    if (hoveredWord) {
      document.addEventListener('mousemove', handleMouseMove);
    } else {
      setMousePosition(null);
    }

    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [hoveredWord]);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Calculate dynamic stats based on selected day
  // Load structured JSON and group by phase
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/wordcloud');
        const data = await res.json();
        const map: PhaseMap = {};

        // Small lexicons for lightweight client-side sentiment tagging
        const positiveLexicon = new Set([
          'good','great','positive','benefit','help','support','improve','love','like','enjoy','useful','successful','success','better','efficient','easy','welcome',
          // German positives
          'gut','positiv','nutzen','nützlich','hilfe','hilfreich','verbessern','besser','einfach','gern','lieben','mögen','zufrieden','zufriedenheit','praktisch','erfolgreich','erfolg'
        ]);
        const negativeLexicon = new Set([
          'bad','problem','issue','concern','complain','difficult','hard','worse','fail','failure','avoid','annoy','frustrat','late',
          // German negatives
          'schlecht','problem','probleme','beschwer','sorgen','unsicher','schwierig','schwierigkeit','frustriert','ärger','ärgerlich','vermeiden','verspät','spät','fehler','stört'
        ]);

        data.forEach((item: any) => {
          const phase = item.phase || 'Discover';
          map[phase] = map[phase] || [];

          // Simple lexicon scan across citizen sentence + keyword
          const textToScan = (((item.roles && item.roles.citizen && item.roles.citizen.original_sentence) || '') + ' ' + (item.keyword || '')).toLowerCase();
          const tokens = textToScan.split(/[^a-z0-9äöüß]+/i).filter(Boolean);
          let score = 0;
          for (const t of tokens) {
            if (positiveLexicon.has(t)) score += 1;
            if (negativeLexicon.has(t)) score -= 1;
          }
          // Prefer server-provided sentiment if available (server applies expanded lexicons and phase boosts)
          const serverSentiment = item.sentiment as 'positive' | 'neutral' | 'negative' | undefined;
          const computedSentiment: 'positive' | 'neutral' | 'negative' = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
          const sentiment: 'positive' | 'neutral' | 'negative' = serverSentiment || computedSentiment;

          // Create a word object compatible with WordCloud
          map[phase].push({
            text: item.keyword,
            size: Math.min(48, Math.max(14, Math.floor((item.keyword || '').length * 3 + 18))),
            sentiment,
            frequency: 1,
          });
        });
        
        console.log('Loaded phase map sample:', Object.fromEntries(Object.entries(map).slice(0,3)).map ? Object.fromEntries(Object.entries(map).slice(0,3)) : Object.keys(map).slice(0,3));
        // Debug: print a small sample of words and their sentiment
        console.log('Sample words with sentiment:', (map[Object.keys(map)[0]] || []).slice(0,5));

  // Debug: log counts per sentiment to help tune lexicons
  const counts: { [k: string]: number } = {};
  Object.values(map).flat().forEach((w) => { counts[w.sentiment || 'neutral'] = (counts[w.sentiment || 'neutral'] || 0) + 1; });
  console.log('Phase map sentiment counts:', counts);

  setPhaseMap(map);
      } catch (err) {
        console.error('Failed to load phase data', err);
      }
    };

    load();
  }, []);

  // Compute simple stats for the selected phase
  const selectedPhaseWords = phaseMap[selectedPhase] || [];
  const dayStats = {
    totalFeedback: selectedPhaseWords.reduce((s, w) => s + (w.frequency || 0), 0),
    activeTopics: selectedPhaseWords.length,
    satisfactionRate: 75,
  };

  // Handle word hover
  const handleWordHover = (word: string | null, event?: React.MouseEvent) => {
    setHoveredWord(word);
    if (!word) {
      setMousePosition(null);
    }
  };

  // Handle day change
  const handlePhaseChange = (index: number) => {
    setPhaseIndex(index);
    setSelectedPhase(PHASES[index]);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && phaseIndex > 0) {
        handlePhaseChange(phaseIndex - 1);
      } else if (e.key === 'ArrowRight' && phaseIndex < PHASES.length - 1) {
        handlePhaseChange(phaseIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [phaseIndex]);

  return (
    <>
      <Head>
        <title>BamBoard - Citizen Feedback Visualization</title>
        <meta name="description" content="Interactive word cloud visualization for citizen feedback analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-display">
                  BamBoard Feedback
                </h1>
                <p className="text-gray-600 mt-1">
                  Interactive citizen feedback visualization
                </p>
              </div>
              
              {/* Role Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">View as:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                        selectedRole === role
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {role === 'Citizen' && '👥'} 
                      {role === 'Designer' && '🎨'} 
                      {role === 'Planner' && '📋'} 
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <motion.main 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Day Slider */}
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Double Diamond Phase
                </h2>
                <div className="text-sm text-gray-500">
                  Use arrow keys or click to navigate
                </div>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => phaseIndex > 0 && handlePhaseChange(phaseIndex - 1)}
                    disabled={phaseIndex === 0}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  
                  <div className="flex-1 relative">
                    {/* Enhanced Day Selector with Better Animations */}
                    <div className="relative bg-gray-50 rounded-xl p-2">
                      <div className="flex justify-between items-center relative">
                        {/* Animated Background */}
                        <motion.div
                          className="absolute top-0 bottom-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-lg"
                          initial={false}
                          animate={{
                            left: `${(phaseIndex / (PHASES.length - 1)) * (100 - (100 / PHASES.length))}%`,
                            width: `${100 / PHASES.length}%`,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            mass: 0.8
                          }}
                        />
                        
                        {PHASES.map((phase, index) => (
                          <motion.button
                            key={phase}
                            onClick={() => handlePhaseChange(index)}
                            className={`relative z-10 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 flex-1 ${
                              index === phaseIndex
                                ? 'text-white shadow-lg'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            whileHover={{ 
                              scale: index === phaseIndex ? 1 : 1.05,
                              y: index === phaseIndex ? 0 : -2
                            }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                          >
                            <motion.span
                              animate={{
                                fontWeight: index === phaseIndex ? 600 : 500,
                                textShadow: index === phaseIndex ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                              }}
                              transition={{ duration: 0.2 }}
                            >
                              {phase}
                            </motion.span>
                            
                            {/* indicator dots */}
                            <motion.div
                              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2"
                              initial={false}
                              animate={{
                                scale: index === phaseIndex ? 1 : 0,
                                opacity: index === phaseIndex ? 1 : 0
                              }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="w-1 h-1 bg-white rounded-full" />
                            </motion.div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Enhanced Progress Bar with Gradient */}
                    <div className="mt-6 relative">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 rounded-full relative"
                          initial={{ width: '0%' }}
                          animate={{ width: `${((phaseIndex + 1) / PHASES.length) * 100}%` }}
                          transition={{ 
                            duration: 0.5,
                            ease: "easeInOut"
                          }}
                        >
                          {/* Animated shine effect */}
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                            animate={{
                              x: ['-100%', '100%']
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                          />
                        </motion.div>
                      </div>
                      
                      {/* Progress indicators */}
                      <div className="flex justify-between mt-2">
                        {PHASES.map((_, index) => (
                          <motion.div
                            key={index}
                            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                              index <= phaseIndex ? 'bg-primary-500' : 'bg-gray-300'
                            }`}
                            animate={{
                              scale: index === phaseIndex ? 1.2 : 1,
                              boxShadow: index === phaseIndex ? '0 0 8px rgba(59, 130, 246, 0.5)' : 'none'
                            }}
                            transition={{ duration: 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => phaseIndex < PHASES.length - 1 && handlePhaseChange(phaseIndex + 1)}
                    disabled={phaseIndex === PHASES.length - 1}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Word Cloud Container */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Citizen Feedback - {selectedPhase}
                </h2>
                <p className="text-gray-600 mt-1">
                  Hover over words to see {selectedRole.toLowerCase()} insights
                </p>
              </div>
              
              {/* Legend */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Positive</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Neutral</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Negative</span>
                </div>
              </div>
            </div>
            
            {/* Word Cloud */}
            <div className="relative min-h-[500px] flex items-center justify-center">
              <WordCloud
                words={selectedPhaseWords}
                selectedDay={selectedPhase}
                selectedRole={selectedRole}
                onWordHover={handleWordHover}
                width={800}
                height={500}
              />
            </div>
          </div>

          {/* Dynamic Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
              key={`feedback-${selectedPhase}`}
            >
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">📈</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Feedback</p>
                  <motion.p 
                    className="text-2xl font-semibold text-gray-900"
                    key={dayStats.totalFeedback}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {dayStats.totalFeedback.toLocaleString()}
                  </motion.p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
              key={`topics-${selectedPhase}`}
            >
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">💭</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Topics</p>
                  <motion.p 
                    className="text-2xl font-semibold text-gray-900"
                    key={dayStats.activeTopics}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    {dayStats.activeTopics}
                  </motion.p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
              key={`satisfaction-${selectedPhase}`}
            >
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  dayStats.satisfactionRate >= 70 ? 'bg-green-100' : 
                  dayStats.satisfactionRate >= 50 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  <span className={`text-xl ${
                    dayStats.satisfactionRate >= 70 ? 'text-green-600' : 
                    dayStats.satisfactionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {dayStats.satisfactionRate >= 70 ? '😊' : 
                     dayStats.satisfactionRate >= 50 ? '😐' : '😞'}
                  </span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                  <motion.p 
                    className="text-2xl font-semibold text-gray-900"
                    key={dayStats.satisfactionRate}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    {dayStats.satisfactionRate}%
                  </motion.p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.main>



        {/* Tooltip */}
        <TooltipManager
          word={hoveredWord}
          selectedDay={selectedPhase}
          selectedRole={selectedRole}
          mousePosition={mousePosition}
        />
      </div>
    </>
  );
}