import React, { useEffect, useRef, useState } from 'react';
import cloud from 'd3-cloud';
import { motion, AnimatePresence } from 'framer-motion';

interface WordData {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  frequency?: number;
}

interface WordCloudProps {
  words: WordData[];
  selectedDay: string;
  selectedRole: string;
  onWordHover: (word: string | null, event?: React.MouseEvent) => void;
  width?: number;
  height?: number;
}

const WordCloud: React.FC<WordCloudProps> = ({
  words,
  selectedDay,
  selectedRole,
  onWordHover,
  width = 800,
  height = 500,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [layoutWords, setLayoutWords] = useState<WordData[]>([]);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  // Log incoming words for debugging
  useEffect(() => {
    console.log('[WordCloud] incoming words:', words.slice(0,10));
  }, [words]);

  // Generate word cloud layout with enhanced collision detection
  useEffect(() => {
    if (!words.length) return;

    // Create an offscreen canvas for accurate text width measurement
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const ctx = canvasRef.current.getContext('2d');

    // Sort words by size (largest first) for better placement
    const sortedWords = [...words].sort((a, b) => b.size - a.size);

    // Compute layout size (smaller than full SVG to leave margin)
    const layoutW = Math.floor(width * 0.9);
    const layoutH = Math.floor(height * 0.9);

    // Phase-specific packing: make Discover and Deliver denser by reducing padding
    const isTightPhase = selectedDay === 'Discover' || selectedDay === 'Deliver';
    const basePaddingDefault = 6;
    const basePaddingTight = 2; // smaller gap between words for denser packing
    const paddingMultiplierDefault = 5;
    const paddingMultiplierTight = 2.5;
    const basePadding = isTightPhase ? basePaddingTight : basePaddingDefault;
    const sizeMultiplier = isTightPhase ? paddingMultiplierTight : paddingMultiplierDefault;

    // Use slightly smaller layout area to create an internal margin and avoid edge overflow
    const layout = cloud()
      .size([layoutW, layoutH])
      .words(sortedWords.map(d => ({ ...d, text: d.text, size: d.size || 20 })))
      .padding((d) => {
        // Slightly increased padding to avoid large-word overflow at edges
        const wordSize = d.size || 20;
        const sizeFactor = wordSize / 50; // Normalize size
        return Math.max(basePadding, basePadding + sizeFactor * sizeMultiplier);
      })
      .rotate(() => 0) // Only horizontal text for better containment
      .font('Inter, system-ui, sans-serif')
      // Cap maximum font size to avoid huge words overflowing the container
      .fontSize(d => Math.min(d.size || 20, 36))
      .fontWeight('500')
      .random(() => 0.5) // Consistent random seed
      .spiral('rectangular') // Rectangular spiral for efficient packing
      .timeInterval(15) // allow ample time for placement
      .on('end', (words) => {
        // Filter out words that couldn't be placed (have no position)
        const placedWords = words.filter(w => w.x !== undefined && w.y !== undefined) as WordData[];

        // If we have a canvas context, measure each text's width/height and clamp positions
        if (ctx) {
          placedWords.forEach(w => {
            // Font size used by d3-cloud (already capped)
            const fontSize = Math.min(w.size || 20, 36);
            // Match the canvas font to the SVG font for accurate measurement
            ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
            const metrics = ctx.measureText(w.text);
            const textWidth = metrics.width || (w.text.length * fontSize * 0.55);
            const textHeight = fontSize; // approximate

            // d3-cloud positions are centered on (0,0) for the layout; layout area runs from
            // -layoutW/2 .. +layoutW/2 horizontally and -layoutH/2 .. +layoutH/2 vertically
            const halfW = textWidth / 2;
            const halfH = textHeight / 2;

            // Clamp/nudge x
            const minX = -layoutW / 2 + halfW + 2; // +2px padding
            const maxX = layoutW / 2 - halfW - 2;
            if (w.x! < minX) w.x = minX;
            if (w.x! > maxX) w.x = maxX;

            // Clamp/nudge y
            const minY = -layoutH / 2 + halfH + 2;
            const maxY = layoutH / 2 - halfH - 2;
            if (w.y! < minY) w.y = minY;
            if (w.y! > maxY) w.y = maxY;
          });
        }

        setLayoutWords(placedWords);
      });

    layout.start();
  }, [words, width, height, selectedDay]);

  // Get color based on sentiment and hover state
  const getWordColor = (word: WordData, isHovered: boolean) => {
    if (isHovered) {
      return '#1d4ed8'; // Primary blue when hovered
    }

    switch (word.sentiment) {
      case 'positive':
        return '#22c55e'; // Green-500 (matches legend)
      case 'negative':
        return '#ef4444'; // Red-500 (matches legend)
      default:
        return '#9ca3af'; // Gray-400 (matches legend)
    }
  };

  // Handle word hover
  const handleWordHover = (word: string | null, event?: React.MouseEvent) => {
    setHoveredWord(word);
    onWordHover(word, event);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.svg
          key={selectedDay} // Key change triggers re-render for day changes
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{
            duration: 0.6,
            ease: "easeInOut"
          }}
        >
          {/* Centered container for word cloud (use SVG center) */}
          <g transform={`translate(${width / 2}, ${height / 2})`}>
            <AnimatePresence mode="wait">
              {layoutWords.map((word, index) => (
                <motion.text
                  key={`${word.text}-${selectedDay}-${index}`}
                  x={word.x || 0}
                  y={word.y || 0}
                  fontSize={word.size}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight={hoveredWord === word.text ? 600 : 500}
                  fill={getWordColor(word, hoveredWord === word.text)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${word.rotate || 0})`}
                  className="cursor-pointer select-none transition-all duration-300"
                  onMouseEnter={() => handleWordHover(word.text)}
                  onMouseLeave={() => handleWordHover(null)}
                  initial={{
                    opacity: 0,
                    y: (word.y || 0) + 30,
                    filter: 'brightness(0.7) contrast(0.8)'
                  }}
                  animate={{
                    opacity: 1,
                    y: word.y || 0,
                    filter: hoveredWord === word.text 
                      ? 'brightness(1.1) drop-shadow(0 0 12px rgba(59, 130, 246, 0.4))' 
                      : 'brightness(1) contrast(1)',
                    fontWeight: hoveredWord === word.text ? 600 : 500
                  }}
                  exit={{
                    opacity: 0,
                    y: (word.y || 0) - 30,
                    filter: 'brightness(0.7) contrast(0.8)'
                  }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.03,
                    ease: [0.4, 0, 0.2, 1] // Industrial cubic-bezier easing
                  }}
                  whileHover={{
                    y: (word.y || 0) - 3,
                    transition: {
                      duration: 0.2,
                      ease: [0.4, 0, 0.2, 1]
                    }
                  }}
                  style={{
                    transformOrigin: 'center center'
                  }}
                >
                  {word.text}
                </motion.text>
              ))}
            </AnimatePresence>
          </g>

          {/* Background circle for better visual centering */}
          <motion.circle
            cx={width / 2}
            cy={height / 2}
            r="2"
            fill="rgba(59, 130, 246, 0.3)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          />
        </motion.svg>
      </AnimatePresence>

      {/* Enhanced Loading indicator */}
      {layoutWords.length === 0 && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex items-center space-x-3 text-gray-500 mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="w-3 h-3 bg-primary-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-3 h-3 bg-primary-400 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-3 h-3 bg-primary-300 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </motion.div>
          <motion.span
            className="text-sm font-medium text-gray-600"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Generating word cloud for {selectedDay}...
          </motion.span>
        </motion.div>
      )}

      {/* Day transition overlay */}
      <AnimatePresence>
        {layoutWords.length > 0 && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 text-sm font-medium text-gray-700 shadow-sm"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {selectedDay}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WordCloud;