import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw } from './Icons';

interface CaptchaProps {
  onCodeChange: (code: string) => void;
}

export interface CaptchaHandle {
  refresh: () => void;
}

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(({ onCodeChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Generate math problem
  const generateMathProblem = () => {
    const operators = ['+', '-', '×', '÷'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let text = '';
    let answer = '';

    if (operator === '+') {
      const num1 = Math.floor(Math.random() * 9) + 1;
      const num2 = Math.floor(Math.random() * 9) + 1;
      text = `${num1} ${operator} ${num2} = ?`;
      answer = (num1 + num2).toString();
    } else if (operator === '-') {
      let num1 = Math.floor(Math.random() * 9) + 1;
      let num2 = Math.floor(Math.random() * 9) + 1;
      if (num1 < num2) [num1, num2] = [num2, num1];
      text = `${num1} ${operator} ${num2} = ?`;
      answer = (num1 - num2).toString();
    } else if (operator === '×') {
      const num1 = Math.floor(Math.random() * 9) + 1;
      const num2 = Math.floor(Math.random() * 9) + 1;
      text = `${num1} ${operator} ${num2} = ?`;
      answer = (num1 * num2).toString();
    } else if (operator === '÷') {
      // Ensure result is an integer by deriving num1 from answer * num2
      const result = Math.floor(Math.random() * 9) + 1;
      const num2 = Math.floor(Math.random() * 9) + 1;
      const num1 = result * num2;
      text = `${num1} ${operator} ${num2} = ?`;
      answer = result.toString();
    }
    
    return { text, answer };
  };

  const drawCaptcha = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#ecfeff'; // cyan-50
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate math problem
    const { text, answer } = generateMathProblem();
    onCodeChange(answer);

    // Add noise (lines)
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(6, 182, 212, ${Math.random() * 0.5})`; // cyan
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Draw text
    ctx.font = 'bold 24px "Noto Sans TC", sans-serif';
    ctx.textBaseline = 'middle';
    
    // Dynamic spacing based on text length to ensure it fits
    const totalWidth = canvas.width;
    const padding = 15;
    const availableWidth = totalWidth - padding * 2;
    // Calculate spacing roughly centered
    const letterSpacing = availableWidth / (text.length - 0.5); 
    const startX = padding;

    for (let i = 0; i < text.length; i++) {
      ctx.save();
      const x = startX + i * letterSpacing;
      const y = canvas.height / 2 + (Math.random() * 4 - 2);
      
      // Random rotation
      const angle = (Math.random() * 0.3) - 0.15;
      
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }

    // Add dots noise
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(100, 116, 139, ${Math.random() * 0.5})`; // slate
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [onCodeChange]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    drawCaptcha();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [drawCaptcha]);

  useImperativeHandle(ref, () => ({
    refresh: handleRefresh
  }));

  useEffect(() => {
    drawCaptcha();
  }, [drawCaptcha]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <canvas 
          ref={canvasRef} 
          width={140} 
          height={56} 
          className="block bg-cyan-50"
        />
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        className="p-3 rounded-xl bg-slate-100 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 hover:shadow-md transition-all duration-300 group"
        title="更換題目"
      >
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
      </button>
    </div>
  );
});

Captcha.displayName = "Captcha";