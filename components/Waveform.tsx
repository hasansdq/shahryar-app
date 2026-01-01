import React from 'react';

interface WaveformProps {
  active: boolean;
  color?: string;
}

const Waveform: React.FC<WaveformProps> = ({ active, color = "bg-teal-400" }) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-12">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full ${color} transition-all duration-300 ${
            active ? 'animate-pulse' : 'h-1.5'
          }`}
          style={{
            height: active ? `${Math.random() * 24 + 12}px` : '4px',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

export default Waveform;