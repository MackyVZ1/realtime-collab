'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface CursorData {
  x: number;
  y: number;
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface DrawLineData {
  prevPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number };
  color: string;
  width: number;
}

const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];

export default function WorkspacePage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const [notes, setNotes] = useState<Record<string, StickyNote>>({});

  // Canvas Whiteboard States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#3b82f6'); // สีน้ำเงินเริ่มต้น
  const [lineWidth, setLineWidth] = useState(4);
  const prevPointRef = useRef<{ x: number; y: number } | null>(null);

  // Note Dragging State
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // -------------------------------------------------------------
  // 1. WebSocket Setup & Window Resize Handler
  // -------------------------------------------------------------
  useEffect(() => {
    const newSocket = io('https://refactored-goldfish-g447pp7rwvjrfr96-3000.app.github.dev/');
    setSocket(newSocket);

    // Dynamic Resize Canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // --- Socket Listeners ---
    newSocket.on('cursor-update', (data: { id: string; x: number; y: number }) => {
      setCursors((prev) => ({ ...prev, [data.id]: { x: data.x, y: data.y } }));
    });

    newSocket.on('user-left', (id: string) => {
      setCursors((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    // Drawing Listeners
    newSocket.on('draw-line', (data: DrawLineData) => {
      drawOnCanvas(data.prevPoint, data.currentPoint, data.color, data.width);
    });

    newSocket.on('clear-canvas', () => {
      clearLocalCanvas();
    });

    // Sticky Notes Listeners
    newSocket.on('note-add', (note: StickyNote) => {
      setNotes((prev) => ({ ...prev, [note.id]: note }));
    });

    newSocket.on('note-update', (updatedNote: Partial<StickyNote> & { id: string }) => {
      setNotes((prev) => ({
        ...prev,
        [updatedNote.id]: { ...prev[updatedNote.id], ...updatedNote },
      }));
    });

    newSocket.on('note-delete', (id: string) => {
      setNotes((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // -------------------------------------------------------------
  // 2. Whiteboard Drawing Helpers
  // -------------------------------------------------------------
  const drawOnCanvas = (
    prevPoint: { x: number; y: number } | null,
    currentPoint: { x: number; y: number },
    color: string,
    width: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startPoint = prevPoint ?? currentPoint;
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearCanvas = () => {
    clearLocalCanvas();
    socket?.emit('clear-canvas');
  };

  // Canvas Mouse Events
  const handleMouseDownCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const point = { x: e.clientX, y: e.clientY };
    prevPointRef.current = point;
  };

  const handleMouseMoveBoard = (e: React.MouseEvent<HTMLDivElement>) => {
    const currentPoint = { x: e.clientX, y: e.clientY };

    // 1. Send cursor position
    socket?.emit('cursor-move', currentPoint);

    // 2. Drawing logic
    if (isDrawing) {
      const lineData: DrawLineData = {
        prevPoint: prevPointRef.current,
        currentPoint,
        color: drawColor,
        width: lineWidth,
      };
      drawOnCanvas(lineData.prevPoint, lineData.currentPoint, lineData.color, lineData.width);
      socket?.emit('draw-line', lineData);
      prevPointRef.current = currentPoint;
    }

    // 3. Dragging Sticky Note logic
    if (draggingNoteId) {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;

      setNotes((prev) => ({
        ...prev,
        [draggingNoteId]: { ...prev[draggingNoteId], x: newX, y: newY },
      }));

      socket?.emit('note-update', { id: draggingNoteId, x: newX, y: newY });
    }
  };

  const handleMouseUpBoard = () => {
    setIsDrawing(false);
    prevPointRef.current = null;
    setDraggingNoteId(null);
  };

  // -------------------------------------------------------------
  // 3. Sticky Notes Handlers
  // -------------------------------------------------------------
  const handleAddNote = () => {
    const newNote: StickyNote = {
      id: `note-${Date.now()}`,
      x: window.innerWidth / 2 - 100 + Math.random() * 40,
      y: window.innerHeight / 2 - 100 + Math.random() * 40,
      text: '',
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    };

    setNotes((prev) => ({ ...prev, [newNote.id]: newNote }));
    socket?.emit('note-add', newNote);
  };

  const handleNoteTextChange = (id: string, text: string) => {
    setNotes((prev) => ({ ...prev, [id]: { ...prev[id], text } }));
    socket?.emit('note-update', { id, text });
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    socket?.emit('note-delete', id);
  };

  const handleStartDragNote = (e: React.MouseEvent, note: StickyNote) => {
    e.stopPropagation(); // ไม่ให้กระทบกับการวาดรูป
    setDraggingNoteId(note.id);
    dragOffsetRef.current = {
      x: e.clientX - note.x,
      y: e.clientY - note.y,
    };
  };

  return (
    <main
      onMouseMove={handleMouseMoveBoard}
      onMouseUp={handleMouseUpBoard}
      className="relative w-screen h-screen bg-slate-950 overflow-hidden select-none"
    >
      {/* 🛠️ Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur border border-slate-800 p-2 rounded-2xl shadow-2xl flex items-center gap-4 text-white">
        {/* สีดินสอ */}
        <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
          <span className="text-xs font-semibold text-slate-400">Pencil:</span>
          {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ffffff'].map((color) => (
            <button
              key={color}
              onClick={() => setDrawColor(color)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                drawColor === color ? 'scale-125 border-white' : 'border-transparent opacity-70'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          {/* ปรับขนาดเส้น */}
          <input
            type="range"
            min="2"
            max="12"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-16 accent-blue-500 cursor-pointer ml-2"
          />
        </div>

        {/* ปุ่มสร้าง Sticky Note */}
        <button
          onClick={handleAddNote}
          className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-1 transition-all"
        >
          <span>+ Sticky Note</span>
        </button>

        {/* ปุ่มล้างกระดาน */}
        <button
          onClick={handleClearCanvas}
          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition-all"
        >
          Clear Whiteboard
        </button>
      </div>

      {/* 🎨 Canvas Layer (สำหรับวาดเส้น) */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDownCanvas}
        className="absolute inset-0 cursor z-0"
      />

      {/* 📌 Sticky Notes Layer */}
      {Object.values(notes).map((note) => (
        <div
          key={note.id}
          style={{ left: `${note.x}px`, top: `${note.y}px`, backgroundColor: note.color }}
          className="absolute z-10 w-48 h-48 rounded-lg shadow-xl p-3 flex flex-col cursor-move text-slate-900 transition-shadow duration-150 hover:shadow-2xl"
          onMouseDown={(e) => handleStartDragNote(e, note)}
        >
          {/* หัวโน้ตสำหรับลาก + ปุ่มลบ */}
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-black/10">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">
              Note
            </span>
            <button
              onClick={() => handleDeleteNote(note.id)}
              className="text-black/40 hover:text-rose-600 font-bold text-xs"
            >
              ✕
            </button>
          </div>

          {/* ช่องพิมพ์ข้อความ */}
          <textarea
          placeholder='พิมพ์ข้อความที่นี่...'
            value={note.text}
            onChange={(e) => handleNoteTextChange(note.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()} // ให้คลิกพิมพ์ได้ ไม่ติด Drag
            className="w-full flex-1 bg-transparent resize-none border-none outline-none text-sm font-medium text-slate-800 placeholder-black/30"
          />
        </div>
      ))}

      {/* 🖱️ Live Cursors Layer */}
      {Object.entries(cursors).map(([id, pos]) => (
        <div
          key={id}
          className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-emerald-400 drop-shadow-md"
          >
            <path d="M5.65376 21.2087L2.125 2.58333L21.375 11.0833L12.5843 13.5701L5.65376 21.2087Z" />
          </svg>
          <span className="ml-3 px-2 py-0.5 bg-emerald-500 text-slate-950 text-[10px] font-extrabold rounded-full shadow">
            {id.slice(0, 4)}
          </span>
        </div>
      ))}
    </main>
  );
}